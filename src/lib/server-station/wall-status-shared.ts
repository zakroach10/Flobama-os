export type ServerStationWallLink = "agent" | "local_runner" | null;

export type ServerStationWallStatus = {
  connected: boolean;
  /** How the wall last checked in — OBS booth agent or local LED runner. */
  link: ServerStationWallLink;
  currentlyPlaying: string;
  offlineReason: string | null;
  activationSource: string | null;
  protectedMode: boolean;
};

export function wallStatusLabel(status: ServerStationWallStatus) {
  if (!status.connected) return "Wall Offline";
  if (status.link === "local_runner") return "Wall Connected · Local Runner";
  return "Wall Connected";
}
