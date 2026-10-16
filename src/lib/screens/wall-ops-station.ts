export const WALL_OPS_STATION_KEY = "flobama-screens-station";

export const WALL_OPS_STATIONS = ["sound-booth", "back-office"] as const;
export type WallOpsStation = (typeof WALL_OPS_STATIONS)[number];

export const WALL_OPS_STATION_LABELS: Record<WallOpsStation, string> = {
  "sound-booth": "Sound Booth",
  "back-office": "Back Office",
};

export function isWallOpsStation(value: string | null | undefined): value is WallOpsStation {
  return value === "sound-booth" || value === "back-office";
}

export function readWallOpsStation(): WallOpsStation {
  if (typeof window === "undefined") return "sound-booth";
  try {
    const raw = window.localStorage.getItem(WALL_OPS_STATION_KEY);
    return isWallOpsStation(raw) ? raw : "sound-booth";
  } catch {
    return "sound-booth";
  }
}

export function writeWallOpsStation(station: WallOpsStation) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WALL_OPS_STATION_KEY, station);
  } catch {
    // Ignore quota / private-mode failures; layout still works for this session.
  }
}
