import { appendFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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
  COMMAND_FILE,
  DEFAULT_CACHE_ROOT,
  LOG_DIR,
  SUPPORT_DIR,
  VERSION,
  expandHome,
} from "./lib/paths.mjs";
import {
  catalogSyncPayload,
  getPerformanceState,
  mergeScanResults,
  openRecordingsCatalog,
  saveCatalog,
} from "./lib/recordings-catalog.mjs";
import {
  DEFAULT_DROPBOX_RELATIVE_ROOT,
  discoverRecordingsCandidates,
  loadRecordingsSettings,
  resolveConfiguredRecordingsRoot,
  saveRecordingsSettings,
} from "./lib/recordings-paths.mjs";
import { inventoryExportRows, inventoryRecordingsFolder, inventoryToCsv } from "./lib/recordings-inventory.mjs";
import { applyPerformanceCommand } from "./lib/performance-controller.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const configPath = resolve(args.find((arg) => arg.endsWith(".json")) || `${__dirname}/local-runner.config.json`);
/** Shell wrapper re-enters pairing setup when the runner exits with this code. */
const EXIT_REAUTH = 77;

class DeviceAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeviceAuthError";
  }
}

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
    recordingsRoot: raw.recordingsRoot ? expandHome(String(raw.recordingsRoot)) : null,
  };
}

async function runDiscoverRecordingsCli() {
  const settings = await loadRecordingsSettings();
  const resolved = await resolveConfiguredRecordingsRoot(settings);
  const candidates = resolved.candidates.length
    ? resolved.candidates
    : await discoverRecordingsCandidates({ dropboxRelativeRoot: settings.dropboxRelativeRoot });
  console.log(
    JSON.stringify(
      {
        settings,
        dropboxRelativeRoot: settings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
        resolvedRoot: resolved.recordingsRoot,
        source: resolved.source,
        candidates,
        count: candidates.length,
      },
      null,
      2,
    ),
  );
  if (!candidates.length) {
    console.error(
      `No folder found for Dropbox-relative path ${settings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT}.`,
    );
    console.error("Configure the local synced path with --set-recordings-root=PATH");
    process.exitCode = 2;
  }
}

async function runInventoryRecordingsCli() {
  const settings = await loadRecordingsSettings();
  const rootArg = args.find((arg) => arg.startsWith("--recordings-root="));
  const relativeArg = args.find((arg) => arg.startsWith("--dropbox-relative-root="));
  const dropboxRelativeRoot = relativeArg
    ? relativeArg.slice("--dropbox-relative-root=".length)
    : settings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT;

  let root = rootArg ? expandHome(rootArg.slice("--recordings-root=".length)) : null;
  if (!root) {
    const resolved = await resolveConfiguredRecordingsRoot({ ...settings, dropboxRelativeRoot });
    root = resolved.recordingsRoot;
  }

  if (!root) {
    console.error("No recordings folder available in this environment.");
    console.error("On the wall Mac, run:");
    console.error("  cd clients/local-runner && node index.mjs --discover-recordings");
    console.error(`  # expects Dropbox-relative ${DEFAULT_DROPBOX_RELATIVE_ROOT}`);
    console.error("  node index.mjs --set-recordings-root=\"/path/to/local/Dropbox/.../Recordings\"");
    console.error("  node index.mjs --inventory-recordings");
    process.exit(2);
  }

  console.error(`Scanning: ${root}`);
  console.error(`Dropbox-relative: ${dropboxRelativeRoot}`);
  const catalog = await openRecordingsCatalog();
  const result = await inventoryRecordingsFolder(root, {
    timeZone: settings.defaultTimezone || "America/Chicago",
  });
  await mergeScanResults(catalog, {
    recordingsRoot: root,
    dropboxRelativeRoot,
    scanned: result.scanned,
    nonVideo: result.nonVideo,
    stats: result.stats,
  });
  await saveRecordingsSettings({
    recordingsRoot: root,
    dropboxRelativeRoot,
    defaultTimezone: settings.defaultTimezone || "America/Chicago",
  });

  const exportPathArg = args.find((arg) => arg.startsWith("--export="));
  const rows = inventoryExportRows(catalog.data);
  const payload = {
    recordingsRoot: root,
    dropboxRelativeRoot,
    scannedAt: result.stats.scannedAt,
    stats: result.stats,
    nonVideoCount: result.nonVideo.length,
    nonVideoSample: result.nonVideo.slice(0, 25),
    rows,
  };
  if (exportPathArg) {
    const out = exportPathArg.slice("--export=".length);
    if (out.endsWith(".csv")) {
      await writeFile(out, inventoryToCsv(rows), "utf8");
    } else {
      await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    }
    console.error(`Wrote export: ${out}`);
  }
  console.log(JSON.stringify({ ...payload, rows: rows.slice(0, 20), rowCount: rows.length }, null, 2));
  console.error(
    `Inventory complete: ${result.stats.sessionFolders || 0} sessions / ${result.stats.videoFiles} videos / ${result.stats.cameraAssets || 0} camera assets.`,
  );
}

async function runSetRecordingsRootCli() {
  const rootArg = args.find((arg) => arg.startsWith("--set-recordings-root="));
  const relativeArg = args.find((arg) => arg.startsWith("--dropbox-relative-root="));
  const root = rootArg ? expandHome(rootArg.slice("--set-recordings-root=".length)) : null;
  if (!root) {
    console.error(
      'Usage: node index.mjs --set-recordings-root="/Users/…/Dropbox/…/Recordings" [--dropbox-relative-root="/A- View 360 Brands/3- Customers/F/Flobama/Recordings"]',
    );
    process.exit(1);
  }
  const settings = await saveRecordingsSettings({
    recordingsRoot: root,
    dropboxRelativeRoot: relativeArg
      ? relativeArg.slice("--dropbox-relative-root=".length)
      : DEFAULT_DROPBOX_RELATIVE_ROOT,
  });
  console.log(JSON.stringify({ ok: true, settings }, null, 2));
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

async function clearDeviceCredential(log) {
  const previous = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        ...previous,
        token: "",
        deviceId: "",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await log(`Cleared invalid device token from ${configPath}`);
}

async function requireReauth(log, message) {
  await log(message);
  await clearDeviceCredential(log);
  await log("Re-pair required: FloBama → Screens → Display devices → new LED Local Runner code, then re-open this app.");
  process.exit(EXIT_REAUTH);
}

async function fetchManifest(config, etag) {
  const headers = { authorization: `Bearer ${config.token}` };
  if (etag) headers["if-none-match"] = `"${etag}"`;
  const response = await fetch(`${config.apiBase}/api/agent/v1/display-devices/manifest`, { headers });
  if (response.status === 304) return { unchanged: true, etag };
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new DeviceAuthError(body.error || "Device credential was not recognized.");
  }
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
  if (args.includes("--discover-recordings")) {
    await runDiscoverRecordingsCli();
    return;
  }
  if (args.includes("--inventory-recordings")) {
    await runInventoryRecordingsCli();
    return;
  }
  if (args.some((arg) => arg.startsWith("--set-recordings-root="))) {
    await runSetRecordingsRootCli();
    return;
  }

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

  // Validate token before binding :4173 so a dead prior runner cannot block re-pairing.
  try {
    await fetchManifest(config, null);
  } catch (error) {
    if (error instanceof DeviceAuthError) {
      await requireReauth(log, error.message);
    }
    await log(`Credential check warning: ${error instanceof Error ? error.message : String(error)}`);
  }

  const db = await openCache(config.cacheRoot);
  const state = { downloads: {}, lastError: null };
  const recordingsCatalog = await openRecordingsCatalog();
  const recordingsSettings = await loadRecordingsSettings();
  if (config.recordingsRoot && !recordingsSettings.recordingsRoot) {
    await saveRecordingsSettings({
      recordingsRoot: config.recordingsRoot,
      dropboxRelativeRoot: recordingsSettings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
    });
    recordingsCatalog.data.recordingsRoot = config.recordingsRoot;
    recordingsCatalog.data.dropboxRelativeRoot =
      recordingsSettings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT;
    await saveCatalog(recordingsCatalog);
  } else {
    const resolved = await resolveConfiguredRecordingsRoot(recordingsSettings);
    if (resolved.recordingsRoot) {
      recordingsCatalog.data.recordingsRoot = resolved.recordingsRoot;
    }
    recordingsCatalog.data.dropboxRelativeRoot = resolved.dropboxRelativeRoot;
    if (resolved.recordingsRoot && !recordingsSettings.recordingsRoot) {
      await saveRecordingsSettings({
        ...recordingsSettings,
        recordingsRoot: resolved.recordingsRoot,
        dropboxRelativeRoot: resolved.dropboxRelativeRoot,
      });
    }
    await saveCatalog(recordingsCatalog);
  }

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
    reloadNonce: Number(savedManifest?.reloadNonce) || Number(getMeta(db, "reloadNonce")) || 1,
    recordingsCatalog,
    pendingScan: Boolean(recordingsCatalog.data.recordingsRoot),
    pendingCatalogSync: true,
    performanceRevision: getPerformanceState(recordingsCatalog).revision || 1,
    acknowledgedCommandIds: new Set(),
  };

  try {
    await startHttpServer(runtime);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
      await log(
        `Port ${config.bindHost}:${config.bindPort} is already in use. Quit the other FloBama Local Runner window, then reopen.`,
      );
      await log(`Or run: lsof -nP -iTCP:${config.bindPort} -sTCP:LISTEN -t | xargs kill`);
      process.exit(1);
    }
    throw error;
  }
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
    if (typeof manifest.reloadNonce === "number") {
      runtime.reloadNonce = manifest.reloadNonce;
      await setMeta(db, "reloadNonce", manifest.reloadNonce);
    }
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
      if (error instanceof DeviceAuthError) {
        await requireReauth(log, `Media sync error: ${error.message}`);
      }
      state.lastError = error instanceof Error ? error.message : String(error);
      await log(`Media sync error: ${state.lastError}`);
    } finally {
      syncingMedia = false;
    }
  }

  async function readObsBounded() {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve({
          connected: Boolean(runtime.obsConnected),
          programScene: runtime.programScene,
          scenes: [],
        });
      }, 1500);
    });
    try {
      return await Promise.race([readObs(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function applyLocalCommand() {
    let raw = "";
    try {
      raw = (await readFile(COMMAND_FILE, "utf8")).trim();
      await unlink(COMMAND_FILE);
    } catch {
      return;
    }
    if (raw === "reload-wall") {
      runtime.reloadNonce = (Number(runtime.reloadNonce) || 1) + 1;
      if (runtime.manifest) runtime.manifest.reloadNonce = runtime.reloadNonce;
      await setMeta(db, "reloadNonce", runtime.reloadNonce);
      await log(`Menu bar reload — wall reload nonce → ${runtime.reloadNonce}`);
    }
    if (raw === "reconnect") {
      runtime.connected = false;
      obsConnected = false;
      try {
        await obs.disconnect();
      } catch {
        /* already closed */
      }
      await log("Menu bar reconnect — checking FloBama and OBS again.");
    }
  }

  let scanningRecordings = false;
  let syncingCatalog = false;

  async function maybeScanRecordings() {
    if (!runtime.pendingScan || scanningRecordings) return;
    const root = runtime.recordingsCatalog.data.recordingsRoot;
    if (!root) {
      runtime.pendingScan = false;
      return;
    }
    scanningRecordings = true;
    runtime.pendingScan = false;
    try {
      await log(`Scanning recordings library: ${root}`);
      const settings = await loadRecordingsSettings();
      const result = await inventoryRecordingsFolder(root, {
        timeZone: settings.defaultTimezone || "America/Chicago",
      });
      await mergeScanResults(runtime.recordingsCatalog, {
        recordingsRoot: root,
        dropboxRelativeRoot: settings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
        scanned: result.scanned,
        nonVideo: result.nonVideo,
        stats: result.stats,
      });
      runtime.pendingCatalogSync = true;
      await log(
        `Recordings scan: ${result.stats.sessionFolders || 0} sessions / ${result.stats.videoFiles} videos / ${result.stats.cameraAssets || 0} cameras`,
      );
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      await log(`Recordings scan failed: ${state.lastError}`);
    } finally {
      scanningRecordings = false;
    }
  }

  async function maybeSyncCatalog() {
    if (!runtime.pendingCatalogSync || syncingCatalog) return;
    syncingCatalog = true;
    runtime.pendingCatalogSync = false;
    try {
      const payload = catalogSyncPayload(runtime.recordingsCatalog, config.deviceId);
      const response = await fetch(`${config.apiBase}/api/agent/v1/display-devices/performance/catalog-sync`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 404) {
        // Migration not applied yet — retry later without treating as fatal.
        runtime.pendingCatalogSync = true;
        return;
      }
      if (!response.ok) {
        const body = await response.text();
        if (response.status === 401) {
          await requireReauth(log, `Catalog sync failed (401): ${body}`);
        }
        throw new Error(`Catalog sync failed (${response.status}): ${body}`);
      }
      const syncBody = await response.json().catch(() => ({}));
      await log(
        `Synced ${payload.recordings.length} recording catalog rows to FloBama OS` +
          (syncBody.upserted != null ? ` (upserted ${syncBody.upserted})` : "") +
          (payload.scanStats?.skippedCameraOrNonEcamm
            ? ` · skipped ${payload.scanStats.skippedCameraOrNonEcamm} camera/non-Ecamm`
            : ""),
      );
    } catch (error) {
      runtime.pendingCatalogSync = true;
      await log(error instanceof Error ? error.message : String(error));
    } finally {
      syncingCatalog = false;
    }
  }

  async function heartbeat() {
    const snapshot = await readObsBounded();
    runtime.obsConnected = snapshot.connected;
    runtime.programScene = snapshot.programScene;
    const perf = getPerformanceState(runtime.recordingsCatalog);

    const response = await fetch(`${config.apiBase}/api/agent/v1/display-devices/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        appVersion: VERSION,
        manifestRevision: runtime.manifestRevision,
        currentAssetId: perf.nowPlaying?.recordingId || null,
        playbackState: perf.mode === "performance" ? perf.nowPlaying?.status || "performance" : "playing",
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
        performance: {
          mode: perf.mode,
          revision: perf.revision,
          audioMuted: perf.audioMuted !== false,
          nowPlaying: perf.nowPlaying,
          queue: perf.queue,
          lastError: perf.lastError,
          recordingsRoot: runtime.recordingsCatalog.data.recordingsRoot,
          lastScanAt: runtime.recordingsCatalog.data.lastScanAt,
          catalogCount: Object.keys(runtime.recordingsCatalog.data.recordings || {}).length,
        },
        lastError: state.lastError,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      runtime.connected = false;
      if (response.status === 401) {
        let message = "Device credential was not recognized.";
        try {
          message = JSON.parse(body).error || message;
        } catch {
          /* keep default */
        }
        await requireReauth(log, `Heartbeat failed (401): ${message}`);
      }
      throw new Error(`Heartbeat failed (${response.status}): ${body}`);
    }

    runtime.connected = true;
    const desired = await response.json();
    if (desired.manifestChanged) {
      void maybeSyncMedia();
    }
    if (desired.commands?.safeRefresh) {
      // Avoid tearing down an active performance for a routine refresh.
      if (perf.mode !== "performance") {
        runtime.reloadNonce = (Number(runtime.reloadNonce) || 1) + 1;
        if (runtime.manifest) runtime.manifest.reloadNonce = runtime.reloadNonce;
        await setMeta(db, "reloadNonce", runtime.reloadNonce);
        await log(`Safe refresh requested — wall reload nonce → ${runtime.reloadNonce}`);
      } else {
        await log("Safe refresh deferred while performance mode is active.");
      }
    }

    const sceneName =
      typeof desired.commands?.desiredObsScene === "string" ? desired.commands.desiredObsScene.trim() : "";
    // Performance mode owns the media OBS scene; still allow explicit cuts when not performing.
    if (perf.mode !== "performance" && sceneName && snapshot.connected && sceneName !== snapshot.programScene) {
      try {
        await obs.call("SetCurrentProgramScene", { sceneName });
        await log(`Cut to ${sceneName}`);
      } catch (error) {
        await log(error instanceof Error ? error.message : `Could not cut to ${sceneName}.`);
      }
    }

    const performanceCommands = Array.isArray(desired.commands?.performanceCommands)
      ? desired.commands.performanceCommands
      : [];
    const commandResults = [];
    for (const command of performanceCommands) {
      if (!command?.id) continue;
      if (runtime.acknowledgedCommandIds.has(command.id)) {
        commandResults.push({ id: command.id, status: "completed", rejectReason: null });
        continue;
      }
      const result = await applyPerformanceCommand(runtime, command);
      runtime.acknowledgedCommandIds.add(command.id);
      commandResults.push({
        id: command.id,
        status: result.status === "accepted" ? "accepted" : result.status === "completed" ? "completed" : "rejected",
        rejectReason: result.rejectReason || null,
      });
      if (result.status === "accepted" && command.kind === "prepare_recording") {
        // Keep accepted; completion happens via catalog sync after prepare finishes.
      }
      await log(`Performance command ${command.kind} (${command.id}): ${result.status}`);
    }
    if (commandResults.length) {
      await fetch(`${config.apiBase}/api/agent/v1/display-devices/performance/command-ack`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandResults }),
      }).catch(() => {});
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
  if (runtime.recordingsCatalog.data.recordingsRoot) {
    await log(`Recordings root: ${runtime.recordingsCatalog.data.recordingsRoot}`);
  } else {
    await log("Recordings root not configured — use Screens → Performance Library or --set-recordings-root");
  }
  void maybeSyncMedia();
  void maybeScanRecordings();

  while (true) {
    try {
      await applyLocalCommand();
      await maybeScanRecordings();
      await heartbeat();
      await maybeSyncCatalog();
      state.lastError = null;
    } catch (error) {
      if (error instanceof DeviceAuthError) {
        await requireReauth(log, error.message);
      }
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
