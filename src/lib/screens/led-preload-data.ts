import type { SupabaseClient } from "@supabase/supabase-js";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { listTodayLedListings } from "@/lib/queries/artist-led";
import {
  LED_PRELOAD_LEAD_MS,
  LED_PRELOAD_REPORT_FRESH_MS,
  mergePreloadItems,
  playlistPreloadItems,
  preloadItemToPublic,
  scheduledPreloadItems,
  summarizePreloadReports,
  type PreloadItem,
  type PreloadReportState,
} from "@/lib/screens/led-preload";
import type { PublicLedMedia } from "@/lib/screens/led-wall";
import type { PublicLedPlayback } from "@/lib/screens/led-playlists";

type Client = SupabaseClient;

export function isMissingPreloadRelation(message: string | null | undefined) {
  return /led_wall_preload_/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export async function loadLedPreloadItems(
  client: Client,
  venueId: string,
  input: { now?: Date; timeZone: string; playback: PublicLedPlayback },
): Promise<{ items: PreloadItem[]; pinsMissing: boolean }> {
  const now = input.now ?? new Date();
  const listingsRes = await listTodayLedListings(client, venueId, input.timeZone, now);
  const scheduled = listingsRes.error
    ? []
    : scheduledPreloadItems(
        listingsRes.listings.map((listing) => ({
          startsAt: listing.startsAt,
          endsAt: listing.endsAt,
          artists: listing.artists.map((artist) => ({
            name: artist.name,
            enabled: artist.enabled,
            sceneId: artist.sceneId,
            scenes: artist.scenes.map((scene) => ({
              sceneId: scene.sceneId,
              title: scene.title,
              publicUrl: scene.publicUrl,
              mediaKind: scene.mediaKind,
              enabled: scene.enabled,
            })),
          })),
        })),
        now.getTime(),
        LED_PRELOAD_LEAD_MS,
      );

  const pinRes = await client
    .from("led_wall_preload_pins" as never)
    .select("scene_id")
    .eq("venue_id", venueId);
  const pinsMissing = Boolean(pinRes.error && isMissingPreloadRelation(pinRes.error.message));
  const pinIds =
    pinRes.error || !pinRes.data
      ? []
      : (pinRes.data as Array<{ scene_id: string }>).map((row) => row.scene_id);

  let manual: PreloadItem[] = [];
  if (pinIds.length > 0) {
    const scenes = await client
      .from("led_wall_scenes")
      .select("id, title, media_kind, public_url, enabled")
      .eq("venue_id", venueId)
      .in("id", pinIds);
    manual = ((scenes.data ?? []) as Array<{
      id: string;
      title: string;
      media_kind: string | null;
      public_url: string | null;
      enabled: boolean;
    }>)
      .filter(
        (scene) =>
          scene.enabled &&
          (scene.media_kind === "image" || scene.media_kind === "video") &&
          Boolean(scene.public_url?.trim()),
      )
      .map((scene) => ({
        id: scene.id,
        title: scene.title,
        url: scene.public_url!.trim(),
        mediaKind: scene.media_kind as "image" | "video",
        source: "manual" as const,
        startsAt: null,
      }));
  }

  const activeIndex =
    input.playback.mode === "playlist"
      ? Math.max(
          0,
          input.playback.playlist.findIndex((item) => item.url && item.url === input.playback.active?.url),
        )
      : 0;
  const playlist = playlistPreloadItems(
    input.playback.playlist.map((item) => ({
      sceneId: item.sceneId,
      title: item.title,
      url: item.url,
      mediaKind: item.mediaKind,
    })),
    activeIndex < 0 ? 0 : activeIndex,
  );

  return {
    items: mergePreloadItems({
      scheduled,
      manual,
      playlist,
      activeUrl: input.playback.active?.url ?? null,
    }),
    pinsMissing,
  };
}

export function publicPreloadMedia(items: PreloadItem[]): PublicLedMedia[] {
  return items.map(preloadItemToPublic);
}

export function preloadReportSummary(
  reports: Array<{ sceneId: string; state: PreloadReportState; updatedAt: string; message: string | null }>,
) {
  const nowMs = Date.now();
  return Object.fromEntries(
    summarizePreloadReports(
      reports.flatMap((report) => {
        const updatedAtMs = Date.parse(report.updatedAt);
        if (!Number.isFinite(updatedAtMs) || nowMs - updatedAtMs > LED_PRELOAD_REPORT_FRESH_MS) return [];
        return [{ sceneId: report.sceneId, state: report.state, updatedAtMs, message: report.message }];
      }),
      nowMs,
    ),
  );
}

export async function venueTimezone(client: Client, venueId = FLO_BAMA_VENUE_ID) {
  const { data } = await client.from("venues").select("timezone").eq("id", venueId).maybeSingle();
  return data?.timezone?.trim() || "America/Chicago";
}

export async function listPreloadReports(client: Client, venueId: string): Promise<{
  reports: Array<{ sceneId: string; state: PreloadReportState; updatedAt: string; message: string | null }>;
  missingTable: boolean;
  error: string | null;
}> {
  const { data, error } = await client
    .from("led_wall_preload_reports" as never)
    .select("scene_id, state, message, updated_at")
    .eq("venue_id", venueId)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) {
    return {
      reports: [] as Array<{ sceneId: string; state: PreloadReportState; updatedAt: string; message: string | null }>,
      missingTable: isMissingPreloadRelation(error.message),
      error: isMissingPreloadRelation(error.message) ? null : error.message,
    };
  }
  return {
    reports: ((data ?? []) as Array<{ scene_id: string; state: string; message: string | null; updated_at: string }>).flatMap(
      (row) => {
        if (row.state !== "loading" && row.state !== "ready" && row.state !== "error") return [];
        return [
          {
            sceneId: row.scene_id,
            state: row.state as PreloadReportState,
            updatedAt: row.updated_at,
            message: row.message,
          },
        ];
      },
    ),
    missingTable: false,
    error: null as string | null,
  };
}

export async function listPreloadPins(client: Client, venueId: string) {
  const { data, error } = await client
    .from("led_wall_preload_pins" as never)
    .select("scene_id")
    .eq("venue_id", venueId);
  if (error) {
    return {
      sceneIds: [] as string[],
      missingTable: isMissingPreloadRelation(error.message),
      error: isMissingPreloadRelation(error.message) ? null : error.message,
    };
  }
  return {
    sceneIds: ((data ?? []) as Array<{ scene_id: string }>).map((row) => row.scene_id),
    missingTable: false,
    error: null as string | null,
  };
}
