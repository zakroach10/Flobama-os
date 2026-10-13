import type { DisplayReloadSignal } from "@/lib/screens/display-signals";

export const HOSTED_PUBLIC_PLAYBACK_SQL =
  "supabase/migrations/20261013000042_hosted_public_playback.sql";

export type HostedPublicSurface = "led" | "vertical";

function envForcesHostedOff(surface: HostedPublicSurface) {
  const key = surface === "led" ? "HOSTED_PUBLIC_LED_ENABLED" : "HOSTED_PUBLIC_VERTICAL_ENABLED";
  const value = process.env[key];
  if (value == null || value.trim() === "") return false;
  return /^(0|false|off|no)$/i.test(value.trim());
}

export function isHostedPublicPlaybackEnabled(
  surface: HostedPublicSurface,
  signal?: Pick<DisplayReloadSignal, "hostedLedPublicEnabled" | "hostedVerticalPublicEnabled"> | null,
) {
  if (envForcesHostedOff(surface)) return false;
  if (surface === "led") return signal?.hostedLedPublicEnabled !== false;
  return signal?.hostedVerticalPublicEnabled !== false;
}

export function hostedPublicDisabledReason(surface: HostedPublicSurface) {
  if (surface === "led") {
    return "Hosted public LED (/display/led) is turned off. Use Local Runner at http://127.0.0.1:4173/wall.";
  }
  return "Hosted public vertical (/display/vertical) is turned off. Use a paired vertical kiosk Local Player.";
}

export function hostedPublicDisabledLedPayload(reloadNonce: number) {
  return {
    disabled: true as const,
    reason: hostedPublicDisabledReason("led"),
    active: null,
    mode: "idle" as const,
    playlist: [] as const,
    playlistId: null,
    startedAt: null,
    revision: "hosted-disabled",
    reloadNonce,
  };
}

export function hostedPublicDisabledVerticalPayload(reloadNonce: number) {
  return {
    disabled: true as const,
    reason: hostedPublicDisabledReason("vertical"),
    ads: [] as const,
    count: 0,
    revision: "hosted-disabled",
    reloadNonce,
    week: null,
    takeover: null,
    trivia: null,
  };
}
