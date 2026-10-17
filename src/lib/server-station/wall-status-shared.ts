export type ServerStationWallStatus = {
  connected: boolean;
  currentlyPlaying: string;
  offlineReason: string | null;
  activationSource: string | null;
  protectedMode: boolean;
};

export function wallStatusLabel(status: ServerStationWallStatus) {
  if (!status.connected) return "Wall Offline";
  return "Wall Connected";
}
