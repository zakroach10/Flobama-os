import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { getPublicLedPlayback } from "@/lib/queries/led-playlists";
import { listPublicVerticalAds } from "@/lib/queries/playlists";
import { getPublicTakeover } from "@/lib/queries/screens";
import {
  listScheduledLedWarmupSceneIds,
  mergeLedWarmupAssetIds,
} from "@/lib/screens/led-schedule-preload";
import { displayRevision } from "@/lib/screens/takeover";
import type { DisplayDeviceKind } from "@/lib/display-devices/types";

type Client = SupabaseClient<Database>;

export type ManifestAsset = {
  id: string;
  version: number;
  sha256: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  mediaType: string | null;
  downloadPath: string;
  storagePath: string | null;
  /** Non-downloadable stream (YouTube). Local runner plays this URL directly. */
  streamUrl?: string | null;
};

export type ManifestItem = {
  slotId: string;
  kind: "media" | "obs" | "week_events";
  assetId: string | null;
  durationSeconds: number;
  transition: string | null;
  obsSceneName: string | null;
};

export type DeviceManifest = {
  revision: string;
  etag: string;
  deviceId: string;
  venueId: string;
  generatedAt: string;
  mode: "idle" | "scene" | "playlist" | "takeover";
  playlistId: string | null;
  startedAt: string | null;
  fallbackPlaylistId: string | null;
  takeover: {
    adId: string;
    assetId: string;
    endsAt: string | null;
  } | null;
  reloadNonce: number;
  items: ManifestItem[];
  assets: ManifestAsset[];
  overlays: {
    triviaEnabled: boolean;
    audienceEnabled: boolean;
  };
};

export const YOUTUBE_MANIFEST_MEDIA_TYPE = "application/vnd.flobama.youtube+json";

function mediaTypeForKind(mediaKind: string | null | undefined) {
  if (mediaKind === "video") return "video/mp4";
  if (mediaKind === "image") return "image/png";
  if (mediaKind === "week_events") return "application/vnd.flobama.week-events+json";
  if (mediaKind === "youtube") return YOUTUBE_MANIFEST_MEDIA_TYPE;
  return null;
}

/**
 * Fingerprint manifest inputs into a short stable revision.
 * Joining asset ids/sha256s raw easily exceeds the heartbeat schema limit (~500).
 */
function buildRevision(parts: Array<string | number | null | undefined>) {
  const raw = parts.map((part) => (part == null ? "" : String(part))).join("|");
  return createHash("sha256").update(raw).digest("hex");
}

type MediaHashRow = {
  asset_id: string;
  storage_path: string;
  sha256: string | null;
  size_bytes: number | null;
  media_type: string | null;
};

async function loadHashes(client: Client, venueId: string, assetIds: string[]) {
  if (assetIds.length === 0) return new Map<string, MediaHashRow>();
  const { data } = await client
    .from("media_content_hashes")
    .select("asset_id, storage_path, sha256, size_bytes, media_type")
    .eq("venue_id", venueId)
    .in("asset_id", assetIds);
  return new Map(((data ?? []) as MediaHashRow[]).map((row) => [row.asset_id, row]));
}

async function loadReloadNonce(client: Client, venueId: string) {
  const { data } = await client
    .from("screen_display_signal_listings")
    .select("reload_nonce")
    .eq("venue_id", venueId)
    .maybeSingle();
  return data?.reload_nonce ?? 1;
}

export async function buildDeviceManifest(
  client: Client,
  input: { deviceId: string; venueId: string; kind: DisplayDeviceKind },
): Promise<DeviceManifest> {
  const generatedAt = new Date().toISOString();
  const reloadNonce = await loadReloadNonce(client, input.venueId);

  if (input.kind === "production_runner") {
    const revision = buildRevision(["production", input.deviceId, generatedAt, reloadNonce]);
    return {
      revision,
      etag: revision,
      deviceId: input.deviceId,
      venueId: input.venueId,
      generatedAt,
      mode: "idle",
      playlistId: null,
      startedAt: null,
      fallbackPlaylistId: null,
      takeover: null,
      reloadNonce,
      items: [],
      assets: [],
      overlays: { triviaEnabled: false, audienceEnabled: false },
    };
  }

  if (input.kind === "led_runner") {
    const [{ playback }, settingsRes, venueRes] = await Promise.all([
      getPublicLedPlayback(client, input.venueId),
      client.from("led_wall_settings").select("default_playlist_id").eq("venue_id", input.venueId).maybeSingle(),
      client.from("venues").select("timezone").eq("id", input.venueId).maybeSingle(),
    ]);

    const timeZone = venueRes.data?.timezone?.trim() || DEFAULT_VENUE_TIMEZONE;
    const items: ManifestItem[] = [];
    const activeAssetIds: string[] = [];
    const storageByAsset = new Map<string, { storagePath: string | null; mediaKind: string | null; duration: number | null }>();

    if (playback.mode === "playlist") {
      for (const item of playback.playlist) {
        const isObs = item.kind === "obs";
        items.push({
          slotId: item.id,
          kind: isObs ? "obs" : "media",
          assetId: isObs ? null : item.sceneId,
          durationSeconds: item.durationSeconds,
          transition: "cut",
          obsSceneName: item.obsSceneName,
        });
        if (!isObs && item.sceneId) {
          activeAssetIds.push(item.sceneId);
          storageByAsset.set(item.sceneId, {
            storagePath: null,
            mediaKind: item.mediaKind,
            duration: item.durationSeconds,
          });
        }
      }
    } else if (playback.active) {
      items.push({
        slotId: playback.active.id,
        kind: "media",
        assetId: playback.active.id,
        durationSeconds: 15,
        transition: "cut",
        obsSceneName: null,
      });
      activeAssetIds.push(playback.active.id);
      storageByAsset.set(playback.active.id, {
        storagePath: null,
        mediaKind: playback.active.mediaKind,
        duration: null,
      });
    }

    // Warm cache for tonight's scheduled artist logos/loops so Server Station /
    // auto-roll cuts do not wait on a first download to the wall.
    const warmupIds = await listScheduledLedWarmupSceneIds(client, input.venueId, timeZone);
    for (const id of warmupIds) {
      if (!storageByAsset.has(id)) {
        storageByAsset.set(id, { storagePath: null, mediaKind: null, duration: null });
      }
    }
    const assetIds = mergeLedWarmupAssetIds(activeAssetIds, warmupIds);

    const streamByAsset = new Map<string, string>();
    if (assetIds.length > 0) {
      const { data: scenes } = await client
        .from("led_wall_scenes")
        .select("id, storage_path, media_kind, public_url")
        .eq("venue_id", input.venueId)
        .in("id", assetIds);
      for (const scene of scenes ?? []) {
        const prior = storageByAsset.get(scene.id);
        storageByAsset.set(scene.id, {
          storagePath: scene.storage_path,
          mediaKind: scene.media_kind ?? prior?.mediaKind ?? null,
          duration: prior?.duration ?? null,
        });
        if (scene.media_kind === "youtube" && scene.public_url) {
          streamByAsset.set(scene.id, scene.public_url);
        }
      }
    }

    const hashes = await loadHashes(client, input.venueId, assetIds);
    const assets: ManifestAsset[] = assetIds.map((id) => {
      const hash = hashes.get(id);
      const meta = storageByAsset.get(id);
      const isYoutube = meta?.mediaKind === "youtube";
      const streamUrl = streamByAsset.get(id) ?? null;
      const version = hash?.sha256 ? 1 : isYoutube && streamUrl ? 1 : 0;
      // Synthetic fingerprint so local runners treat the stream as "ready" without a blob.
      const youtubeSha =
        isYoutube && streamUrl
          ? createHash("sha256").update(`youtube:${streamUrl}`).digest("hex")
          : null;
      return {
        id,
        version,
        sha256: hash?.sha256 ?? youtubeSha,
        sizeBytes: hash?.size_bytes ?? null,
        durationSeconds: meta?.duration ?? null,
        mediaType: hash?.media_type ?? mediaTypeForKind(meta?.mediaKind),
        downloadPath: `/api/agent/v1/display-devices/assets/${id}/download`,
        storagePath: hash?.storage_path ?? meta?.storagePath ?? null,
        streamUrl,
      };
    });

    const revision = buildRevision([
      "led",
      playback.mode,
      playback.playlistId,
      playback.startedAt,
      playback.revision,
      reloadNonce,
      `warmup:${warmupIds.join(",")}`,
      ...assets.map((asset) => `${asset.id}:${asset.sha256 ?? "pending"}`),
    ]);

    return {
      revision,
      etag: revision,
      deviceId: input.deviceId,
      venueId: input.venueId,
      generatedAt,
      mode: playback.mode === "idle" ? "idle" : playback.mode === "playlist" ? "playlist" : "scene",
      playlistId: playback.playlistId,
      startedAt: playback.startedAt,
      fallbackPlaylistId: settingsRes.data?.default_playlist_id ?? null,
      takeover: null,
      reloadNonce,
      items,
      assets,
      overlays: { triviaEnabled: true, audienceEnabled: true },
    };
  }

  // vertical_kiosk — use media_id/special_id (not playlist item id) as downloadable asset ids
  const [adsRes, takeoverRes, activePlaylistRes] = await Promise.all([
    listPublicVerticalAds(client, input.venueId),
    getPublicTakeover(client, input.venueId),
    client
      .from("screen_playlists")
      .select("id")
      .eq("venue_id", input.venueId)
      .eq("is_active", true)
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  const items: ManifestItem[] = [];
  const assetIds: string[] = [];
  const storageByAsset = new Map<
    string,
    { storagePath: string | null; mediaKind: string | null; duration: number | null; assetKind: "screen_ad" | "menu_special" }
  >();

  let takeover: DeviceManifest["takeover"] = null;
  if (takeoverRes.takeover) {
    const ad = takeoverRes.takeover.ad;
    takeover = {
      adId: ad.id,
      assetId: ad.id,
      endsAt: takeoverRes.takeover.endsAt,
    };
    assetIds.push(ad.id);
    storageByAsset.set(ad.id, {
      storagePath: null,
      mediaKind: ad.mediaKind,
      duration: ad.durationSeconds,
      assetKind: "screen_ad",
    });
  }

  const playlistId = activePlaylistRes.data?.id ?? null;
  if (playlistId) {
    const { data: playlistItems } = await client
      .from("screen_playlist_items")
      .select("id, source_kind, media_id, special_id, duration_seconds, transition")
      .eq("venue_id", input.venueId)
      .eq("playlist_id", playlistId)
      .eq("enabled", true)
      .is("archived_at", null)
      .order("sort_order", { ascending: true });

    for (const row of playlistItems ?? []) {
      if (row.source_kind === "week_events") {
        items.push({
          slotId: row.id,
          kind: "week_events",
          assetId: null,
          durationSeconds: row.duration_seconds ?? 12,
          transition: row.transition,
          obsSceneName: null,
        });
        continue;
      }
      const assetId = row.media_id ?? row.special_id;
      items.push({
        slotId: row.id,
        kind: "media",
        assetId,
        durationSeconds: row.duration_seconds ?? 10,
        transition: row.transition,
        obsSceneName: null,
      });
      if (assetId) {
        assetIds.push(assetId);
        storageByAsset.set(assetId, {
          storagePath: null,
          mediaKind: null,
          duration: row.duration_seconds,
          assetKind: row.media_id ? "screen_ad" : "menu_special",
        });
      }
    }
  } else {
    for (const ad of adsRes.ads) {
      const isWeek = ad.mediaKind === "week_events";
      items.push({
        slotId: ad.id,
        kind: isWeek ? "week_events" : "media",
        assetId: isWeek ? null : ad.id,
        durationSeconds: ad.durationSeconds ?? 10,
        transition: ad.transition,
        obsSceneName: null,
      });
      if (!isWeek) {
        assetIds.push(ad.id);
        storageByAsset.set(ad.id, {
          storagePath: null,
          mediaKind: ad.mediaKind,
          duration: ad.durationSeconds,
          assetKind: "screen_ad",
        });
      }
    }
  }

  const uniqueAssetIds = [...new Set(assetIds)];
  if (uniqueAssetIds.length > 0) {
    const [{ data: ads }, { data: specials }] = await Promise.all([
      client
        .from("screen_ads")
        .select("id, storage_path, media_kind, duration_seconds")
        .eq("venue_id", input.venueId)
        .in("id", uniqueAssetIds),
      client
        .from("menu_specials")
        .select("id, storage_path, media_kind, duration_seconds")
        .eq("venue_id", input.venueId)
        .in("id", uniqueAssetIds),
    ]);
    for (const ad of ads ?? []) {
      const prior = storageByAsset.get(ad.id);
      storageByAsset.set(ad.id, {
        storagePath: ad.storage_path,
        mediaKind: ad.media_kind ?? prior?.mediaKind ?? null,
        duration: ad.duration_seconds ?? prior?.duration ?? null,
        assetKind: "screen_ad",
      });
    }
    for (const special of specials ?? []) {
      const prior = storageByAsset.get(special.id);
      storageByAsset.set(special.id, {
        storagePath: special.storage_path,
        mediaKind: special.media_kind ?? prior?.mediaKind ?? null,
        duration: special.duration_seconds ?? prior?.duration ?? null,
        assetKind: "menu_special",
      });
    }
  }

  const hashes = await loadHashes(client, input.venueId, uniqueAssetIds);
  const assets: ManifestAsset[] = uniqueAssetIds.map((id) => {
    const hash = hashes.get(id);
    const meta = storageByAsset.get(id);
    return {
      id,
      version: hash?.sha256 ? 1 : 0,
      sha256: hash?.sha256 ?? null,
      sizeBytes: hash?.size_bytes ?? null,
      durationSeconds: meta?.duration ?? null,
      mediaType: hash?.media_type ?? mediaTypeForKind(meta?.mediaKind),
      downloadPath: `/api/agent/v1/display-devices/assets/${id}/download`,
      storagePath: hash?.storage_path ?? meta?.storagePath ?? null,
    };
  });

  const revision = buildRevision([
    "vertical",
    displayRevision(adsRes.ads, takeoverRes.takeover),
    takeover?.adId,
    takeover?.endsAt,
    reloadNonce,
    ...assets.map((asset) => `${asset.id}:${asset.sha256 ?? "pending"}`),
  ]);

  return {
    revision,
    etag: revision,
    deviceId: input.deviceId,
    venueId: input.venueId,
    generatedAt,
    mode: takeover ? "takeover" : items.length ? "playlist" : "idle",
    playlistId,
    startedAt: null,
    fallbackPlaylistId: null,
    takeover,
    reloadNonce,
    items,
    assets,
    overlays: { triviaEnabled: false, audienceEnabled: false },
  };
}
