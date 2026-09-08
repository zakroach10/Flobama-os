import { WEEK_EVENTS_PUBLIC_URL, type ScreenMediaKind, type ScreenTransition } from "@/lib/constants";

export type StaffScreenAd = {
  id: string;
  title: string;
  public_url: string;
  media_kind: ScreenMediaKind;
  duration_seconds: number | null;
  transition: ScreenTransition;
  sort_order: number;
  enabled: boolean;
  archived_at: string | null;
};

export type PublicScreenAd = {
  id: string;
  title: string;
  url: string;
  mediaKind: ScreenMediaKind;
  durationSeconds: number | null;
  transition: ScreenTransition;
};

export function isWeekEventsUrl(url: string | null | undefined) {
  return (url ?? "").startsWith(WEEK_EVENTS_PUBLIC_URL);
}

export function resolvePublicMediaKind(ad: {
  media_kind?: ScreenMediaKind | string;
  mediaKind?: ScreenMediaKind | string;
  public_url?: string;
  url?: string;
}): ScreenMediaKind {
  if (isWeekEventsUrl(ad.url ?? ad.public_url) || ad.media_kind === "week_events" || ad.mediaKind === "week_events") {
    return "week_events";
  }
  return (ad.mediaKind ?? ad.media_kind ?? "image") as ScreenMediaKind;
}

export function toPublicPlaylist(ads: StaffScreenAd[]): PublicScreenAd[] {
  return [...ads]
    .filter((ad) => ad.enabled && ad.archived_at === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ad) =>
      normalizePublicAd({
        id: ad.id,
        title: ad.title,
        url: ad.public_url,
        mediaKind: resolvePublicMediaKind(ad),
        durationSeconds: ad.duration_seconds,
        transition: ad.transition,
      }),
    );
}

export function normalizePublicAd(ad: PublicScreenAd): PublicScreenAd {
  return {
    ...ad,
    mediaKind: resolvePublicMediaKind(ad),
  };
}

export function normalizePublicPlaylist(ads: PublicScreenAd[]) {
  return ads.map(normalizePublicAd);
}

export function holdMsForAd(ad: PublicScreenAd, fallbackImageSeconds = 10): number {
  const kind = resolvePublicMediaKind(ad);
  if (kind === "video" && ad.durationSeconds == null) return 0;
  const seconds = Math.max(1, ad.durationSeconds ?? fallbackImageSeconds);
  if (kind === "week_events") return Math.max(12, seconds) * 1000;
  return seconds * 1000;
}

export function nextPlaylistIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return (index + 1) % length;
}

export function playlistsEqual(left: PublicScreenAd[], right: PublicScreenAd[]) {
  if (left.length !== right.length) return false;
  return left.every(
    (ad, index) =>
      ad.id === right[index]?.id &&
      ad.url === right[index]?.url &&
      ad.mediaKind === right[index]?.mediaKind &&
      ad.durationSeconds === right[index]?.durationSeconds &&
      ad.transition === right[index]?.transition,
  );
}

export function isWeekEventsAd(
  ad:
    | Pick<PublicScreenAd, "mediaKind" | "url">
    | Pick<StaffScreenAd, "media_kind" | "public_url">,
) {
  return resolvePublicMediaKind(ad) === "week_events";
}
