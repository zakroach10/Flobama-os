import type { ScreenTransition } from "@/lib/constants";

export type StaffScreenAd = {
  id: string;
  title: string;
  public_url: string;
  media_kind: "image" | "video";
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
  mediaKind: "image" | "video";
  durationSeconds: number | null;
  transition: ScreenTransition;
};

export function toPublicPlaylist(ads: StaffScreenAd[]): PublicScreenAd[] {
  return [...ads]
    .filter((ad) => ad.enabled && ad.archived_at === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ad) => ({
      id: ad.id,
      title: ad.title,
      url: ad.public_url,
      mediaKind: ad.media_kind,
      durationSeconds: ad.duration_seconds,
      transition: ad.transition,
    }));
}

export function holdMsForAd(ad: PublicScreenAd, fallbackImageSeconds = 10): number {
  if (ad.mediaKind === "video" && ad.durationSeconds == null) return 0;
  return Math.max(1, ad.durationSeconds ?? fallbackImageSeconds) * 1000;
}
