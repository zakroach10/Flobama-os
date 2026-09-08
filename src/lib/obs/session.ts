export const OBS_STORAGE_KEYS = {
  host: "flobama-obs-host",
  port: "flobama-obs-port",
  password: "flobama-obs-password",
} as const;

export type ObsConnectionInput = {
  host: string;
  port: string;
  password: string;
};

export function defaultObsConnection(): ObsConnectionInput {
  return { host: "127.0.0.1", port: "4455", password: "" };
}

export function buildObsWebsocketUrl(host: string, port: string): string | null {
  const trimmedHost = host.trim();
  const trimmedPort = port.trim();
  if (!trimmedHost || !/^\d{2,5}$/.test(trimmedPort)) return null;
  if (/[/\s]/.test(trimmedHost)) return null;
  return `ws://${trimmedHost}:${trimmedPort}`;
}

export function readObsConnection(): ObsConnectionInput {
  if (typeof window === "undefined") return defaultObsConnection();
  return {
    host: sessionStorage.getItem(OBS_STORAGE_KEYS.host) ?? "127.0.0.1",
    port: sessionStorage.getItem(OBS_STORAGE_KEYS.port) ?? "4455",
    password: sessionStorage.getItem(OBS_STORAGE_KEYS.password) ?? "",
  };
}

export function writeObsConnection(value: ObsConnectionInput) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OBS_STORAGE_KEYS.host, value.host.trim());
  sessionStorage.setItem(OBS_STORAGE_KEYS.port, value.port.trim());
  sessionStorage.setItem(OBS_STORAGE_KEYS.password, value.password);
}

export type ObsScene = {
  sceneName: string;
  sceneIndex: number;
};

export function mapObsSceneList(payload: {
  scenes?: Array<{ sceneName?: string; sceneIndex?: number }>;
  currentProgramSceneName?: string;
  currentPreviewSceneName?: string;
}): { scenes: ObsScene[]; program: string | null; preview: string | null } {
  const scenes = (payload.scenes ?? [])
    .map((scene, index) => ({
      sceneName: scene.sceneName ?? "",
      sceneIndex: scene.sceneIndex ?? index,
    }))
    .filter((scene) => scene.sceneName.length > 0)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);
  return {
    scenes,
    program: payload.currentProgramSceneName ?? null,
    preview: payload.currentPreviewSceneName ?? null,
  };
}
