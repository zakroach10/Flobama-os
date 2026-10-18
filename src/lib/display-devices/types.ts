export const DISPLAY_DEVICE_KINDS = ["led_runner", "vertical_kiosk"] as const;
export type DisplayDeviceKind = (typeof DISPLAY_DEVICE_KINDS)[number];

export const DISPLAY_DEVICE_KIND_LABELS: Record<DisplayDeviceKind, string> = {
  led_runner: "LED Local Runner",
  vertical_kiosk: "Vertical kiosk",
};

export const DISPLAY_PAIRING_TTL_MS = 10 * 60 * 1000;
export const DISPLAY_DEVICE_STALE_MS = 180_000;
export const DISPLAY_DOWNLOAD_URL_TTL_SECONDS = 900;

export const MEDIA_ASSET_KINDS = ["screen_ad", "led_scene", "menu_special", "audience_asset"] as const;
export type MediaAssetKind = (typeof MEDIA_ASSET_KINDS)[number];

export type StaffDisplayDevice = {
  id: string;
  label: string;
  kind: DisplayDeviceKind;
  revoked_at: string | null;
  last_seen_at: string | null;
  app_version: string | null;
  hostname: string | null;
  created_at: string;
  status: StaffDisplayDeviceStatus | null;
};

export type StaffDisplayDeviceStatus = {
  obs_connected: boolean | null;
  program_scene: string | null;
  cache_bytes: number | null;
  cache_limit_bytes: number | null;
  assets_ready: number | null;
  assets_pending: number | null;
  manifest_revision: string | null;
  current_asset_id: string | null;
  playback_state: string | null;
  disk_free_bytes: number | null;
  last_error: string | null;
  reported_at: string;
};

export function isDisplayDeviceStale(lastSeenAt: string | null | undefined, now = Date.now()) {
  if (!lastSeenAt) return true;
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return true;
  return now - seen > DISPLAY_DEVICE_STALE_MS;
}

export function freshestLedRunner<T extends { kind: string; revoked_at: string | null; last_seen_at: string | null }>(
  devices: T[],
): T | null {
  const runners = devices.filter((device) => device.kind === "led_runner" && !device.revoked_at);
  runners.sort((left, right) => Date.parse(right.last_seen_at || "") - Date.parse(left.last_seen_at || ""));
  return runners[0] ?? null;
}

export type LedRunnerLink = {
  online: boolean;
  label: string;
  deviceId: string | null;
  programScene: string | null;
  pendingDownloads: number;
};

/** Prefer a fresh local runner. Fall back to a fresh booth agent so the wall is not marked offline while scenes still switch. */
export function describeLedRunnerLink(
  device: StaffDisplayDevice | null,
  agent?: { fresh: boolean; programScene: string | null },
): LedRunnerLink {
  const pendingDownloads = device?.status?.assets_pending ?? 0;
  const programScene = device?.status?.program_scene?.trim() || null;
  const name = device?.label?.trim() || device?.hostname?.trim() || "Local runner";
  const downloading = pendingDownloads > 0 ? ` · ${pendingDownloads} downloading` : "";
  if (device && !isDisplayDeviceStale(device.last_seen_at)) {
    const obsDown = device.status?.obs_connected === false;
    const label = obsDown
      ? `${name} connected · OBS offline${downloading}`
      : programScene
        ? `${name} connected · ${programScene}${downloading}`
        : `${name} connected${downloading}`;
    return { online: true, label, deviceId: device.id, programScene, pendingDownloads };
  }
  if (agent?.fresh) {
    return {
      online: true,
      label: agent.programScene ? `Booth connected · ${agent.programScene}` : "Booth connected",
      deviceId: device?.id ?? null,
      programScene: agent.programScene,
      pendingDownloads,
    };
  }
  if (!device) {
    return {
      online: false,
      label: "No local runner paired",
      deviceId: null,
      programScene: null,
      pendingDownloads: 0,
    };
  }
  return {
    online: false,
    label: device.last_seen_at ? `${name} offline` : `${name} has not checked in`,
    deviceId: device.id,
    programScene,
    pendingDownloads,
  };
}
