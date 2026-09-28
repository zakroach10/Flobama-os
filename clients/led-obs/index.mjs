import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import OBSWebSocket from "obs-websocket-js";

const configPath = process.argv[2] || "led-obs.config.json";
const config = JSON.parse(await readFile(configPath, "utf8"));
const apiBase = String(config.apiBase ?? "").replace(/\/$/, "");
const token = String(config.token ?? "");
const obsHost = String(config.obsHost ?? "127.0.0.1").trim();
const obsPort = String(config.obsPort ?? "4455").trim();
const obsPassword = String(config.obsPassword ?? "");

if (!/^https?:\/\//.test(apiBase)) {
  console.error("apiBase must start with http:// or https://");
  process.exit(1);
}
if (!token || token === "paste-the-booth-token") {
  console.error("Set the booth token in the config file.");
  process.exit(1);
}
if (!obsHost || /[/\s]/.test(obsHost) || !/^\d{2,5}$/.test(obsPort)) {
  console.error("OBS host or port is invalid.");
  process.exit(1);
}

const obs = new OBSWebSocket();
let connected = false;

obs.on("ConnectionClosed", () => {
  connected = false;
});

async function ensureObs() {
  if (connected) return true;
  try {
    await obs.connect(`ws://${obsHost}:${obsPort}`, obsPassword || undefined);
    connected = true;
    console.log(`Connected to OBS at ws://${obsHost}:${obsPort}`);
    return true;
  } catch (error) {
    connected = false;
    console.error(error instanceof Error ? error.message : "Could not reach OBS.");
    return false;
  }
}

async function readObs() {
  if (!(await ensureObs())) {
    return { obsConnected: false, programScene: null, scenes: [] };
  }
  try {
    const list = await obs.call("GetSceneList");
    const scenes = (list.scenes ?? [])
      .map((scene) => (scene && typeof scene.sceneName === "string" ? scene.sceneName.trim() : ""))
      .filter((name) => name.length > 0);
    return {
      obsConnected: true,
      programScene: typeof list.currentProgramSceneName === "string" ? list.currentProgramSceneName : null,
      scenes,
    };
  } catch (error) {
    connected = false;
    console.error(error instanceof Error ? error.message : "OBS scene list failed.");
    return { obsConnected: false, programScene: null, scenes: [] };
  }
}

async function tick() {
  const snapshot = await readObs();
  const response = await fetch(`${apiBase}/api/agent/v1/led-wall/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Sync failed (${response.status}): ${body}`);
    return;
  }
  const desired = (await response.json()) as { desiredObsScene?: string | null };
  const sceneName = desired.desiredObsScene?.trim() ?? "";
  if (!sceneName || !snapshot.obsConnected || sceneName === snapshot.programScene) return;
  try {
    await obs.call("SetCurrentProgramScene", { sceneName });
    console.log(`Cut to ${sceneName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : `Could not cut to ${sceneName}.`);
  }
}

console.log(`Polling ${apiBase} for LED wall scenes.`);
while (true) {
  try {
    await tick();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Booth client tick failed.");
  }
  await delay(1000);
}
