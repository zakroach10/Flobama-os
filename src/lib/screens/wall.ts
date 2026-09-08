export type WallMode = "auto" | "manual";

export type WallStateInput = {
  mode: WallMode;
  adsSceneName: string | null;
  bandSceneName: string | null;
  manualSceneName: string | null;
};

export function shouldUseBandScene(input: {
  nowPlaying: boolean;
  overlappingPublicEvent: boolean;
  takeoverActive?: boolean;
}): boolean {
  return input.nowPlaying || input.overlappingPublicEvent || Boolean(input.takeoverActive);
}

export function liveFromNowPayload(
  json: {
    nowPlaying?: { id?: string } | null;
    today?: Array<{ startsAt: string; endsAt: string }>;
    takeoverActive?: boolean;
  },
  nowIso = new Date().toISOString(),
): { nowPlaying: boolean; overlappingPublicEvent: boolean; takeoverActive: boolean } {
  const overlapping = (json.today ?? []).some((event) => event.startsAt <= nowIso && event.endsAt > nowIso);
  return {
    nowPlaying: Boolean(json.nowPlaying?.id),
    overlappingPublicEvent: overlapping,
    takeoverActive: Boolean(json.takeoverActive),
  };
}

export function resolveWallScene(
  wall: WallStateInput,
  live: { nowPlaying: boolean; overlappingPublicEvent: boolean; takeoverActive?: boolean },
): string | null {
  if (wall.mode === "manual") {
    return emptyToNull(wall.manualSceneName);
  }
  return shouldUseBandScene(live) ? emptyToNull(wall.bandSceneName) : emptyToNull(wall.adsSceneName);
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
