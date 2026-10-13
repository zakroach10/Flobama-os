export const DISPLAY_DEVICE_KINDS = ["led_runner", "vertical_kiosk"] as const;
export type DisplayDeviceKind = (typeof DISPLAY_DEVICE_KINDS)[number];

export const DISPLAY_DEVICE_KIND_LABELS: Record<DisplayDeviceKind, string> = {
  led_runner: "LED Local Runner",
  vertical_kiosk: "Vertical kiosk",
};

export const DISPLAY_PAIRING_TTL_MS = 10 * 60 * 1000;
export const DISPLAY_DEVICE_STALE_MS = 60_000;
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
