import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import OBSWebSocket from "obs-websocket-js";
import { openCache, cacheBytesUsed, listAssets, setMeta, getMeta, evictIfNeeded } from "./lib/cache-db.mjs";
import { syncManifestAssets } from "./lib/downloader.mjs";
import { startHttpServer } from "./lib/http-server.mjs";
import { startMenubarHelper, writeMenubarStatus } from "./lib/menubar.mjs";
import {
  DEFAULT_CACHE_ROOT,
  LOG_DIR,
  SUPPORT_DIR,
  VERSION,
  expandHome,
} from "./lib/paths.mjs";
import { unlink } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const configPath = resolve(args.find((arg) => arg.endsWith(".json")) || `${__dirname}/local-runner.config.json`);

async function loadConfig() {
  const raw = JSON.parse(await readFile(configPath, "utf8"));
  return {
    apiBase: String(raw.apiBase ?? "").replace(/\/$/, ""),
    token: String(raw.token ?? ""),
    deviceId: String(raw.deviceId ?? ""),
    label: String(raw.label ?? "FloBama Local Runner"),
    obsHost: String(raw.obsHost ?? "127.0.0.1").trim(),
    obsPort: String(raw.obsPort ?? "4455").trim(),
    obsPassword: String(raw.obsPassword ?? ""),
    bindHost: String(raw.bindHost ?? "127.0.0.1"),
    bindPort: Number(raw.bindPort ?? 4173),
    cacheRoot: expandHome(String(raw.cacheRoot ?? DEFAULT_CACHE_ROOT)),
    maxCacheBytes: Number(raw.maxCacheBytes ?? 40_000_000_000),
    heartbeatMs: Number(raw.heartbeatMs ?? 2000),
    menubarEnabled: raw.menubarEnabled !== false,
  };
}

async function makeLogger() {
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(SUPPORT_DIR, { recursive: true });
  const logFile = `${LOG_DIR}/runner.log`;
  return async (message) => {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(message);
    await appendFile(logFile, `${line}\n`).catch(() => {});
  };
}

async function pair(config, log) {
  const codeArg = args.find((arg) => arg.startsWith("--code="));
  const code = codeArg ? codeArg.slice("--code=".length) : args[args.indexOf("--pair") + 1];
  if (!code || code.startsWith("-")) {
    console.error("Usage: node index.mjs --pair --code=ABCD1234");
    process.exit(1);
  }
  if (!/^https?:\/\//.test(config.apiBase)) {
    console.error("Set apiBase in the config file first.");
    process.exit(1);
  }

  const cleanedCode = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const host = hostname().trim();
  const label = String(config.label || "FloBama Local Runner").trim() || "FloBama Local Runner";
  const payload = {
    code: cleanedCode,
    label,
    kind: "led_runner",
    appVersion: VERSION,
  };
  if (host) payload.hostname = host;

  const response = await fetch(`${config.apiBase}/api/agent/v1/display-devices/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail ? ` (${body.detail})` : "";
    await log(`Pair failed (${response.status}): ${body.error || "unknown"}${detail}`);
    process.exit(1);
  }

  const previous = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        ...previous,
        apiBase: config.apiBase,
        token: body.token,
        deviceId: body.deviceId,
        label: config.label,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await log(`Paired as ${body.deviceId}. Token saved to config.`);
  process.exit(0);
}

async function fetchManifest(config, etag) {
  const headers = { authorization: `Bearer ${config.token}` };
  if (etag) headers["if-none-match"] = `"${etag}"`;
  const response = await fetch(`${config.apiBase}/api/agent/v1/display-devices/manifest`, { headers });
  if (response.status === 304) return { unchanged: true, etag };
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Manifest failed (${response.status})`);
  return { unchanged: false, manifest: body, etag: body.etag || body.revision };
}

function readSavedManifest(db) {
  const raw = getMeta(db, "manifestJson");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function main() {
  const log = await makeLogger();
  let config = await loadConfig();

  if (args.includes("--pair")) {
    await pair(config, log);
    return;
  }

  if (!/^https?:\/\//.test(config.apiBase)) {
    console.error("apiBase must start with http:// or https://");
    process.exit(1);
  }
  if (!config.token) {
    console.error("No device token yet.");
    console.error("Open FloBama → Screens → Display devices, create an LED Local Runner pairing code,");
    console.error("then re-open this app (or run: node index.mjs --pair --code=YOURCODE config.json).");
    console.error(`Config file: ${configPath}`);
    process.exit(1);
  }

  const db = await openCache(config.cacheRoot);
  const state = { downloads: {}, lastError: null };
  const savedManifest = readSavedManifest(db);
  const runtime = {
    version: VERSION,
    config,
    db,
    state,
    log,
    connected: false,
    obsConnected: false,
    programScene: null,
    // Restore last manifest so /api/playback is not idle across restarts before the next 200.
    manifest: savedManifest,
    manifestRevision: savedManifest?.revision || getMeta(db, "manifestRevision"),
    manifestEtag: getMeta(db, "manifestEtag"),
  };

  await startHttpServer(runtime);
  if (config.menubarEnabled) startMenubarHelper(log);

  const obs = new OBSWebSocket();
  let obsConnected = false;
  obs.on("ConnectionClosed", () => {
    obsConnected = false;
  });

  async function ensureObs() {
    if (obsConnected) return true;
    try {
      await obs.connect(`ws://${config.obsHost}:${config.obsPort}`, config.obsPassword || undefined);
      obsConnected = true;
      await log(`Connected to OBS at ws://${config.obsHost}:${config.obsPort}`);
      return true;
    } catch (error) {
      obsConnected = false;
      await log(error instanceof Error ? error.message : "Could not reach OBS.");
      return false;
    }
  }

  async function readObs() {
    if (!(await ensureObs())) {
      return { connected: false, programScene: null, scenes: [] };
    }
    try {
      const list = await obs.call("GetSceneList");
      const scenes = (list.scenes ?? [])
        .map((scene) => (scene && typeof scene.sceneName === "string" ? scene.sceneName.trim() : ""))
        .filter(Boolean);
      return {
        connected: true,
        programScene: typeof list.currentProgramSceneName === "string" ? list.currentProgramSceneName : null,
        scenes,
      };
    } catch (error) {
      obsConnected = false;
      await log(error instanceof Error ? error.message : "OBS scene list failed.");
      return { connected: false, programScene: null, scenes: [] };
    }
  }

  let syncingMedia = false;

  async function applyManifest(manifest, etag) {
    runtime.manifest = manifest;
    runtime.manifestRevision = manifest.revision;
    runtime.manifestEtag = etag;
    await setMeta(db, "manifestRevision", manifest.revision);
    await setMeta(db, "manifestEtag", etag);
    await setMeta(db, "manifestJson", JSON.stringify(manifest));
    await log(`Manifest ${manifest.revision} — syncing ${manifest.assets?.length ?? 0} assets`);
    await syncManifestAssets(db, config, manifest, state);
    await evictIfNeeded(db, config.maxCacheBytes, null, unlink);
  }

  async function maybeSyncMedia() {
    if (syncingMedia) return;
    syncingMedia = true;
    try {
      let result = await fetchManifest(config, runtime.manifestEtag);
      // 304 after restart used to keep runtime.manifest null forever (etag persisted, body not).
      if (result.unchanged && !runtime.manifest) {
        result = await fetchManifest(config, null);
      }
      if (result.unchanged) {
        if (runtime.manifest) {
          await syncManifestAssets(db, config, runtime.manifest, state);
          await evictIfNeeded(db, config.maxCacheBytes, null, unlink);
        }
        return;
      }
      await applyManifest(result.manifest, result.etag);
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      await log(`Media sync error: ${state.lastError}`);
    } finally {
      syncingMedia = false;
    }
  }

  async function heartbeat() {
    const snapshot = await readObs();
    runtime.obsConnected = snapshot.connected;
    runtime.programScene = snapshot.programScene;

    const response = await fetch(`${config.apiBase}/api/agent/v1/display-devices/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        appVersion: VERSION,
        manifestRevision: runtime.manifestRevision,
        playbackState: "playing",
        obs: {
          connected: snapshot.connected,
          programScene: snapshot.programScene,
          scenes: snapshot.scenes,
        },
        cache: {
          bytesUsed: cacheBytesUsed(db),
          bytesLimit: config.maxCacheBytes,
          assetsReady: listAssets(db).filter((a) => a.state === "ready").length,
          assetsPending: listAssets(db).filter((a) => a.state === "downloading").length,
        },
        downloads: {
          active: Object.entries(state.downloads).map(([assetId, progress]) => ({
            assetId,
            bytesReceived: progress.received,
            bytesTotal: progress.total,
          })),
        },
        lastError: state.lastError,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      runtime.connected = false;
      throw new Error(`Heartbeat failed (${response.status}): ${body}`);
    }

    runtime.connected = true;
    const desired = await response.json();
    if (desired.manifestChanged) {
      void maybeSyncMedia();
    }
    if (desired.commands?.safeRefresh) {
      await log("Safe refresh requested — remounting wall clients via reload nonce on next poll.");
    }

    const sceneName =
      typeof desired.commands?.desiredObsScene === "string" ? desired.commands.desiredObsScene.trim() : "";
    if (sceneName && snapshot.connected && sceneName !== snapshot.programScene) {
      try {
        await obs.call("SetCurrentProgramScene", { sceneName });
        await log(`Cut to ${sceneName}`);
      } catch (error) {
        await log(error instanceof Error ? error.message : `Could not cut to ${sceneName}.`);
      }
    }
  }

  async function publishStatus() {
    const ready = listAssets(db).filter((a) => a.state === "ready").length;
    const pending = listAssets(db).filter((a) => a.state === "downloading").length;
    const used = cacheBytesUsed(db);
    await writeMenubarStatus({
      title: runtime.connected ? (runtime.obsConnected ? "Flo ✓" : "Flo ·") : "Flo ✗",
      detail: runtime.connected
        ? `Online · ${runtime.manifestRevision ? `rev ${String(runtime.manifestRevision).slice(0, 18)}…` : "syncing"}`
        : "Disconnected from FloBama OS",
      wallUrl: `http://${config.bindHost}:${config.bindPort}/wall`,
      cacheLine: `Cache ${ready} ready` + (pending ? ` · ${pending} downloading` : "") + ` · ${(used / 1e9).toFixed(2)} GB`,
      obsLine: runtime.obsConnected
        ? `OBS · ${runtime.programScene || "connected"}`
        : "OBS disconnected",
    });
  }

  await log(`FloBama Local Runner ${VERSION}`);
  await log(`Cache root: ${config.cacheRoot}`);
  await log(`Wall URL: http://${config.bindHost}:${config.bindPort}/wall`);
  await maybeSyncMedia();

  while (true) {
    try {
      await heartbeat();
      state.lastError = null;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      await log(state.lastError);
    }
    await publishStatus();
    await delay(config.heartbeatMs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
