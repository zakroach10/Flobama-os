import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { applySimCommand, listSimulatedCameras, renderSimSnapshotPng } from "./lib/sim-cameras.mjs";
import { createAdapter, discoverNdiSources } from "./lib/adapters.mjs";
import { createMoveWatchdog } from "./lib/watchdog.mjs";

const VERSION = "1.0.0";
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

  const next = {
    ...config,
    token: body.token,
    deviceId: body.deviceId,
    pollMs: body.pollMs ?? config.pollMs,
  };
  // Persist without expanding helpers
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        apiBase: next.apiBase,
        token: next.token,
        deviceId: next.deviceId,
        label: next.label,
        remoteControlEnabled: next.remoteControlEnabled,
        useSimulatedCameras: next.useSimulatedCameras,
        pollMs: next.pollMs,
        moveWatchdogMs: next.moveWatchdogMs,
        logDir: String((await readFile(configPath, "utf8").then(JSON.parse)).logDir ?? "~/Library/Logs/FloBamaMacConnector"),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await log(`Paired as device ${body.deviceId}. Credential stored in ${configPath}.`);
  console.log("Pairing complete. Start the connector with: npm start");
}

async function doctor(config, log) {
  await log(`FloBama Mac Connector ${VERSION}`);
  await log(`Config: ${configPath}`);
  await log(`Host: ${hostname()}`);
  await log(`API: ${config.apiBase || "(missing)"}`);
  await log(`Token: ${config.token ? "present" : "missing — run --pair"}`);
  await log(`Remote control: ${config.remoteControlEnabled ? "enabled" : "DISABLED locally"}`);
  await log(`Simulated cameras: ${config.useSimulatedCameras ? "ON" : "off"}`);
  const ndi = discoverNdiSources();
  await log(`NDI: ${ndi.note}`);
  if (config.token && config.apiBase) {
    try {
      const response = await fetch(`${config.apiBase}/api/agent/v1/cameras/sync`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          remoteControlEnabled: config.remoteControlEnabled,
          hostname: hostname(),
          connectorVersion: VERSION,
          cameras: [],
        }),
      });
      await log(`Sync probe: HTTP ${response.status}`);
    } catch (error) {
      await log(`Sync probe failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function toReport(camera) {
  const { state: _state, ...rest } = camera;
  return rest;
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

  const cameras = config.useSimulatedCameras ? listSimulatedCameras() : [];
  if (!config.useSimulatedCameras) {
    const ndi = discoverNdiSources();
    await log(ndi.note);
  }
  const byKey = new Map(cameras.map((camera) => [camera.sourceKey, camera]));

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

  // Local disable switch: flip remoteControlEnabled in config and it takes effect next tick.
  async function reloadRemoteFlag() {
    try {
      const fresh = await loadConfig();
      config.remoteControlEnabled = fresh.remoteControlEnabled !== false;
    } catch {
      /* keep prior */
    }
  }

  await log(`FloBama Mac Connector ${VERSION} polling ${config.apiBase}`);
  await log(
    config.remoteControlEnabled
      ? "Remote control ENABLED. Set remoteControlEnabled=false in config to disable locally."
      : "Remote control DISABLED on this Mac.",
  );

  while (true) {
    try {
      await reloadRemoteFlag();
      const commandResults = [];
      const previewUpdates = [];

      // Sync first to pull work; process after.
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
          cameras: cameras.map(toReport),
          commandResults,
          previewUpdates,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        await log(`Sync failed (${response.status}): ${text}`);
        // Fail-safe: stop all motion if we lose the control plane.
        for (const camera of cameras) {
          applySimCommand(camera, "ptz_stop", {});
          watchdog.clear(camera.sourceKey);
        }
        await delay(config.pollMs);
        continue;
      }

      const desired = await response.json();
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
        await log(`Command ${command.kind} on ${camera.sourceKey}`);
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
            error:
              "WebRTC preview requires TURN and a media worker; snapshot mode is active until those are provisioned.",
          });
          continue;
        }
        const png = renderSimSnapshotPng(camera);
        previewUpdates.push({
          sessionId: session.id,
          status: "active",
          snapshotBase64: png.toString("base64"),
          snapshotContentType: "image/png",
        });
      }

      // Post results on the next loop iteration by issuing an immediate follow-up when needed.
      if (commandResults.length || previewUpdates.length) {
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
            cameras: cameras.map(toReport),
            commandResults,
            previewUpdates,
          }),
        });
      }
    } catch (error) {
      await log(error instanceof Error ? error.message : "Connector tick failed.");
      for (const camera of cameras) {
        applySimCommand(camera, "ptz_stop", {});
      }
      watchdog.clearAll();
    }
    await delay(config.pollMs);
  }
}

await run();
