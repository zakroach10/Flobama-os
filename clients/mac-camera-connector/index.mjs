import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { applySimCommand } from "./lib/sim-cameras.mjs";
import { buildLocalCameras } from "./lib/inventory.mjs";
import { createAdapter, discoverNdiSources, captureNdiPreviewPng, ndiRuntimeStatus } from "./lib/adapters.mjs";
import { createMoveWatchdog } from "./lib/watchdog.mjs";
import { encodeRgbaPng, renderCameraPreviewPng } from "./lib/preview-render.mjs";
import { startMenubarHelper, writeMenubarStatus } from "./lib/menubar.mjs";

const VERSION = "1.2.0";
const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const configPath = resolve(args.find((arg) => arg.endsWith(".json")) || join(__dirname, "mac-camera.config.json"));

function expandHome(path) {
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

async function loadConfig() {
  const raw = JSON.parse(await readFile(configPath, "utf8"));
  return {
    apiBase: String(raw.apiBase ?? "").replace(/\/$/, ""),
    token: String(raw.token ?? ""),
    deviceId: String(raw.deviceId ?? ""),
    label: String(raw.label ?? "FloBama Mac"),
    remoteControlEnabled: raw.remoteControlEnabled !== false,
    useSimulatedCameras: raw.useSimulatedCameras !== false,
    menubarEnabled: raw.menubarEnabled !== false,
    pollMs: Number(raw.pollMs ?? 750),
    moveWatchdogMs: Number(raw.moveWatchdogMs ?? 1200),
    logDir: expandHome(String(raw.logDir ?? "~/Library/Logs/FloBamaMacConnector")),
  };
}

async function ensureLog(config) {
  await mkdir(config.logDir, { recursive: true });
  const logFile = join(config.logDir, "connector.log");
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
    console.error("Set apiBase in the config file first (https://your-app-host).");
    process.exit(1);
  }

  const response = await fetch(`${config.apiBase}/api/agent/v1/cameras/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      label: config.label,
      hostname: hostname(),
      connectorVersion: VERSION,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    await log(`Pair failed (${response.status}): ${body.error || "unknown"}`);
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
        pollMs: body.pollMs ?? config.pollMs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await log(`Paired as device ${body.deviceId}. Credential stored in ${configPath}.`);
  console.log("Pairing complete.");
}

async function doctor(config, log) {
  await log(`FloBama Mac Camera ${VERSION}`);
  await log(`Config: ${configPath}`);
  await log(`Host: ${hostname()}`);
  await log(`API: ${config.apiBase || "(missing)"}`);
  await log(`Token: ${config.token ? "present" : "missing — run --pair"}`);
  await log(`Remote control: ${config.remoteControlEnabled ? "enabled" : "DISABLED locally"}`);
  await log(`Builtin sims when inventory empty of sims: ${config.useSimulatedCameras ? "ON" : "off"}`);
  await log(`Menu bar: ${config.menubarEnabled ? "enabled" : "disabled"}`);
  const runtime = ndiRuntimeStatus();
  await log(`NDI runtime: ${runtime.note}`);
  const ndi = await discoverNdiSources({ force: true, waitMs: 2500 });
  await log(`NDI discovery: ${ndi.note}`);
  for (const source of ndi.sources.slice(0, 20)) {
    await log(`  · ${source.name}${source.urlAddress ? ` (${source.urlAddress})` : ""}`);
  }
}

function toReport(camera) {
  const { state: _state, ndiUrlAddress: _url, ...rest } = camera;
  return rest;
}

async function publishStatus(config, cameras, controlledKeys, syncOk, ndiNote) {
  const onlineCount = cameras.filter((c) => c.online).length;
  const pendingNdi = cameras.filter((c) => c.linkStatus === "ndi_pending").length;
  const liveNdi = cameras.filter((c) => c.linkStatus === "ndi_live").length;
  const controlling = controlledKeys?.[0] ? cameras.find((c) => c.sourceKey === controlledKeys[0]) : null;
  let title = "Cam ○";
  let detail = "Mac connector offline from FloBama OS";
  if (syncOk) {
    if (!config.remoteControlEnabled) {
      title = "Cam ✕";
      detail = "Connected · remote PTZ disabled on this Mac";
    } else if (controlling) {
      title = "Cam ◉";
      detail = `Controlling ${controlling.title}`;
    } else {
      title = "Cam ●";
      detail =
        `Connected · ${onlineCount} live / ${cameras.length} cameras` +
        (liveNdi ? ` · ${liveNdi} NDI` : "") +
        (pendingNdi ? ` · ${pendingNdi} NDI pending` : "");
      if (ndiNote && !liveNdi && pendingNdi) detail += ` · ${ndiNote}`;
    }
  }
  await writeMenubarStatus({
    title,
    detail,
    syncOk,
    cameraCount: cameras.length,
    onlineCount,
    pendingNdi,
    liveNdi,
    controlling: controlling?.title || null,
    updatedAt: new Date().toISOString(),
  });
  return detail;
}

async function buildPreviewPng(camera, controlling) {
  if (camera.linkStatus === "ndi_live" && camera.connectionTarget) {
    const live = await captureNdiPreviewPng(
      { name: camera.connectionTarget, urlAddress: camera.ndiUrlAddress },
      {
        encodeRgbaPng: (w, h, rgba) =>
          encodeRgbaPng(w, h, rgba, {
            title: camera.title,
            controlling,
          }),
      },
    );
    if (live) return live;
  }
  return renderCameraPreviewPng(camera, {
    controlling,
    linkStatus: camera.linkStatus,
  });
}

async function run() {
  let config;
  try {
    config = await loadConfig();
  } catch {
    console.error(`Missing config at ${configPath}. Copy config.example.json to mac-camera.config.json`);
    process.exit(1);
  }
  const log = await ensureLog(config);

  if (args.includes("--doctor")) {
    await doctor(config, log);
    return;
  }
  if (args.includes("--pair")) {
    await pair(config, log);
    return;
  }

  if (!/^https?:\/\//.test(config.apiBase)) {
    console.error("apiBase must start with http:// or https://");
    process.exit(1);
  }
  if (!config.token) {
    console.error("No device token. Run: node index.mjs --pair --code=YOURCODE");
    process.exit(1);
  }

  let inventory = [];
  let discoveredNdi = [];
  let ndiNote = "NDI discovery starting…";
  let cameras = buildLocalCameras({ inventory, discoveredNdi, includeBuiltinSims: config.useSimulatedCameras });
  let byKey = new Map(cameras.map((camera) => [camera.sourceKey, camera]));
  let controlledKeys = [];

  if (config.menubarEnabled) {
    await publishStatus(config, cameras, controlledKeys, false, ndiNote);
    startMenubarHelper(log);
  }

  const watchdog = createMoveWatchdog({
    timeoutMs: config.moveWatchdogMs,
    log: (message) => {
      void log(message);
    },
    onFire: (sourceKey) => {
      const camera = byKey.get(sourceKey);
      if (!camera) return;
      applySimCommand(camera, "ptz_stop", {});
      const adapter = createAdapter(camera);
      void adapter.stop();
    },
  });

  async function reloadRemoteFlag() {
    try {
      const fresh = await loadConfig();
      config.remoteControlEnabled = fresh.remoteControlEnabled !== false;
      config.useSimulatedCameras = fresh.useSimulatedCameras !== false;
      config.menubarEnabled = fresh.menubarEnabled !== false;
    } catch {
      /* keep prior */
    }
  }

  await log(`FloBama Mac Camera ${VERSION} polling ${config.apiBase}`);
  await log(
    config.remoteControlEnabled
      ? "Remote control ENABLED. Set remoteControlEnabled=false in config to disable locally."
      : "Remote control DISABLED on this Mac.",
  );
  await log("Discovering NDI sources on this Mac and merging with Cameras inventory.");

  let lastNdiLog = "";
  while (true) {
    try {
      await reloadRemoteFlag();
      const commandResults = [];
      const previewUpdates = [];

      const discovery = await discoverNdiSources();
      discoveredNdi = discovery.sources;
      ndiNote = discovery.note;
      if (discovery.note !== lastNdiLog) {
        await log(`NDI: ${discovery.note}`);
        lastNdiLog = discovery.note;
      }

      cameras = buildLocalCameras({
        inventory,
        discoveredNdi,
        includeBuiltinSims: config.useSimulatedCameras && inventory.length === 0,
      });
      const prev = byKey;
      byKey = new Map();
      for (const camera of cameras) {
        const old = prev.get(camera.sourceKey);
        if (old?.state) camera.state = old.state;
        byKey.set(camera.sourceKey, camera);
      }

      const response = await fetch(`${config.apiBase}/api/agent/v1/cameras/sync`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          hostname: hostname(),
          connectorVersion: VERSION,
          remoteControlEnabled: config.remoteControlEnabled,
          statusDetail: await publishStatus(config, cameras, controlledKeys, true, ndiNote),
          cameras: cameras.map(toReport),
          commandResults: [],
          previewUpdates: [],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        await log(`Sync failed (${response.status}): ${text}`);
        for (const camera of cameras) {
          applySimCommand(camera, "ptz_stop", {});
          watchdog.clear(camera.sourceKey);
        }
        await publishStatus(config, cameras, [], false, ndiNote);
        await delay(config.pollMs);
        continue;
      }

      const desired = await response.json();
      inventory = desired.inventory ?? [];
      controlledKeys = desired.controlledSourceKeys ?? [];
      cameras = buildLocalCameras({
        inventory,
        discoveredNdi,
        includeBuiltinSims: config.useSimulatedCameras && inventory.length === 0,
      });
      // Preserve motion state across rebuilds for matching keys.
      const afterInventory = byKey;
      byKey = new Map();
      for (const camera of cameras) {
        const old = afterInventory.get(camera.sourceKey);
        if (old?.state) camera.state = old.state;
        byKey.set(camera.sourceKey, camera);
      }

      const now = Date.now();
      for (const command of desired.commands ?? []) {
        if (Date.parse(command.expiresAt) <= now) {
          commandResults.push({
            id: command.id,
            status: "expired",
            rejectReason: "Expired before Mac execution.",
          });
          continue;
        }
        const camera = byKey.get(command.sourceKey);
        if (!camera) {
          commandResults.push({
            id: command.id,
            status: "rejected",
            rejectReason: "Unknown sourceKey on Mac.",
          });
          continue;
        }
        if (!config.remoteControlEnabled && command.kind !== "ptz_stop") {
          commandResults.push({
            id: command.id,
            status: "rejected",
            rejectReason: "Remote control disabled on Mac.",
          });
          continue;
        }

        let result;
        if (camera.isSimulated || camera.protocol === "simulated") {
          result = applySimCommand(camera, command.kind, command.payload);
        } else if (camera.linkStatus === "ndi_pending" || camera.linkStatus === "visca_pending") {
          result = {
            ok: false,
            reason: camera.lastError || "Camera link is pending — not live yet.",
          };
        } else {
          const adapter = createAdapter(camera);
          if (command.kind === "ptz_stop") result = await adapter.stop();
          else result = await adapter.move(command);
        }

        if (!result.ok) {
          commandResults.push({ id: command.id, status: "rejected", rejectReason: result.reason });
          continue;
        }

        if (command.kind === "ptz_move" || command.kind === "ptz_zoom") {
          watchdog.arm(camera.sourceKey);
        } else if (command.kind === "ptz_stop") {
          watchdog.clear(camera.sourceKey);
        }

        commandResults.push({ id: command.id, status: "completed" });
        await log(`Command ${command.kind} on ${camera.sourceKey} (${camera.title})`);
      }

      for (const session of desired.previewSessions ?? []) {
        const camera = byKey.get(session.sourceKey);
        if (!camera) {
          previewUpdates.push({ sessionId: session.id, status: "failed", error: "Unknown camera." });
          continue;
        }
        if (session.mode === "webrtc") {
          previewUpdates.push({
            sessionId: session.id,
            status: "failed",
            error: "WebRTC preview requires TURN/media worker; snapshot mode is active.",
          });
          continue;
        }
        try {
          const png = await buildPreviewPng(camera, controlledKeys.includes(camera.sourceKey));
          previewUpdates.push({
            sessionId: session.id,
            status: "active",
            snapshotBase64: png.toString("base64"),
            snapshotContentType: "image/png",
          });
        } catch (error) {
          previewUpdates.push({
            sessionId: session.id,
            status: "failed",
            error: error instanceof Error ? error.message : "Preview render failed.",
          });
        }
      }

      // Always push camera/discovery state + any command/preview results.
      await fetch(`${config.apiBase}/api/agent/v1/cameras/sync`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          hostname: hostname(),
          connectorVersion: VERSION,
          remoteControlEnabled: config.remoteControlEnabled,
          statusDetail: await publishStatus(config, cameras, controlledKeys, true, ndiNote),
          cameras: cameras.map(toReport),
          commandResults,
          previewUpdates,
        }),
      });
    } catch (error) {
      await log(error instanceof Error ? error.message : "Connector tick failed.");
      for (const camera of cameras) {
        applySimCommand(camera, "ptz_stop", {});
      }
      watchdog.clearAll();
      await publishStatus(config, cameras, [], false, ndiNote);
    }
    await delay(config.pollMs);
  }
}

await run();
