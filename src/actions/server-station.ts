"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activateDefaultAdRollAction } from "@/actions/artist-led";
import {
  getServerStationGate,
  writeServerStationAudit,
  type ServerStationGateOk,
} from "@/lib/server-station/context";
import { listServerStationEvents } from "@/lib/server-station/events";
import {
  durationPresetLabel,
  resolveServerStationEndsAt,
  type ServerStationDurationPreset,
} from "@/lib/server-station/expiration";
import {
  validateGuestDisplayName,
  validateServerStationMessage,
  validateSpecialCopy,
} from "@/lib/server-station/moderation";
import { clearExpiredLedOverride, getLedWallProtection } from "@/lib/server-station/overrides";
import { getServerStationSettings } from "@/lib/server-station/settings";
import {
  isServerStationActivatableScene,
  listServerApprovedScenes,
} from "@/lib/server-station/scenes";
import { getServerStationWallStatus } from "@/lib/server-station/wall-status";
import {
  insertServerSlideAfterCurrentAd,
  loadAdRollItems,
  readAdRollHold,
  rebaseLiveAdRoll,
  restoreAdRollAfterOverride,
} from "@/lib/server-station/ad-roll";
import { isMissingServerStationRelation, SERVER_STATION_SQL } from "@/lib/auth/server-station";
import { SERVER_STATION_UPLOAD_TTL_SECONDS } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPublicAppUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";
import { hashDisplaySecret } from "@/lib/display-devices/crypto";
import { randomBytes } from "node:crypto";
import { SERVER_STATION_TEMPLATES } from "@/lib/server-station/templates";

export type ServerStationActionResult = {
  ok: boolean;
  message: string;
  queued?: boolean;
  itemId?: string;
  uploadUrl?: string;
  sessionId?: string;
  expiresAt?: string;
};

function sqlMessage(message: string) {
  if (isMissingServerStationRelation(message)) {
    return `Apply ${SERVER_STATION_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

function contentDb(gate: ServerStationGateOk) {
  // Kiosk already uses the service role. Staff sessions (server/manager) cannot
  // insert LED scenes under admin-only RLS, so content writes use the same client
  // after the gate has authorized them.
  return createServiceRoleClient() ?? gate.writeClient;
}

function revalidateServerStation() {
  revalidatePath("/server");
  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/api/public/v1/screens/led");
  revalidatePath("/settings");
}

const durationSchema = z.union([z.literal(5), z.literal(15), z.literal(30), z.literal("tonight")]);

async function resolveTemporaryPlaylistId(
  client: ServerStationGateOk["writeClient"],
  venueId: string,
  configuredId: string | null,
) {
  if (configuredId) return configuredId;
  const { data: settings } = await client
    .from("led_wall_settings")
    .select("default_playlist_id")
    .eq("venue_id", venueId)
    .maybeSingle();
  return settings?.default_playlist_id ?? null;
}

async function nextSceneSortOrder(
  client: ServerStationGateOk["writeClient"],
  venueId: string,
) {
  const { count } = await client
    .from("led_wall_scenes")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  return count ?? 0;
}

export async function getServerStationDashboardAction() {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false as const, message: gate.message };
  const wall = await getServerStationWallStatus(gate.writeClient, gate.venueId);
  const { settings } = await getServerStationSettings(gate.writeClient, gate.venueId);
  return {
    ok: true as const,
    wall,
    settings,
    actor: gate.actor,
    mode: gate.mode,
  };
}

export async function listServerStationEventsAction(input: unknown) {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false as const, message: gate.message, events: [] };
  const parsed = z
    .object({
      bucket: z.enum(["tonight", "tomorrow", "weekend", "upcoming", "search"]),
      query: z.string().trim().max(80).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid search.", events: [] };

  const result = await listServerStationEvents(gate.writeClient, gate.venueId, {
    bucket: parsed.data.bucket,
    query: parsed.data.query,
    timeZone: gate.timeZone,
  });
  if (result.error) return { ok: false as const, message: result.error, events: [] };
  return { ok: true as const, events: result.events };
}

export async function listServerApprovedScenesAction() {
  const gate = await getServerStationGate("access");
  if (!gate.ok) {
    return {
      ok: false as const,
      message: gate.message,
      scenes: [],
      artistScenes: [],
      houseScenes: [],
      playlists: [],
      defaultPlaylistId: null,
    };
  }

  const result = await listServerApprovedScenes(gate.writeClient, gate.venueId);
  if (result.error) {
    return {
      ok: false as const,
      message: sqlMessage(result.error),
      scenes: [],
      artistScenes: [],
      houseScenes: [],
      playlists: [],
      defaultPlaylistId: null,
    };
  }

  return {
    ok: true as const,
    scenes: result.scenes,
    artistScenes: result.artistScenes,
    houseScenes: result.houseScenes,
    playlists: result.playlists,
    defaultPlaylistId: result.defaultPlaylistId,
  };
}

export async function activateServerStationSceneAction(input: unknown): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      sceneId: z.string().uuid().optional(),
      playlistId: z.string().uuid().optional(),
      resumeNormal: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a wall option." };

  // Scene commands write to led_wall_runtime; the local runner or booth agent
  // picks them up on the next heartbeat even if check-in looked stale.

  if (parsed.data.resumeNormal) {
    // Clear any server override first, then return to house ads / default playlist.
    await gate.writeClient.from("led_wall_overrides").delete().eq("venue_id", gate.venueId);
    if (gate.mode === "staff" && gate.staffContext) {
      const result = await activateDefaultAdRollAction();
      await writeServerStationAudit(gate.writeClient, {
        venueId: gate.venueId,
        actor: gate.actor,
        action: "resume_normal",
        detail: { ok: result.ok, message: result.message },
      });
      revalidateServerStation();
      return { ok: result.ok, message: result.ok ? "Returned to normal rotation." : result.message };
    }

    const { data: settings } = await gate.writeClient
      .from("led_wall_settings")
      .select("default_playlist_id")
      .eq("venue_id", gate.venueId)
      .maybeSingle();
    if (!settings?.default_playlist_id) {
      return { ok: false, message: "House ads playlist is not set up yet. Ask a manager." };
    }
    const { error } = await gate.writeClient.from("led_wall_runtime").upsert(
      {
        venue_id: gate.venueId,
        active_scene_id: null,
        active_playlist_id: settings.default_playlist_id,
        activation_source: "ad_roll",
        auto_event_id: null,
        auto_artist_id: null,
      },
      { onConflict: "venue_id" },
    );
    if (error) return { ok: false, message: sqlMessage(error.message) };
    await writeServerStationAudit(gate.writeClient, {
      venueId: gate.venueId,
      actor: gate.actor,
      action: "resume_normal",
    });
    revalidateServerStation();
    return { ok: true, message: "Returned to normal rotation." };
  }

  if (parsed.data.playlistId) {
    const { data: playlist } = await gate.writeClient
      .from("led_wall_playlists")
      .select("id, name")
      .eq("id", parsed.data.playlistId)
      .eq("venue_id", gate.venueId)
      .is("archived_at", null)
      .maybeSingle();
    if (!playlist) return { ok: false, message: "That playlist is not available." };

    const { error } = await gate.writeClient.from("led_wall_runtime").upsert(
      {
        venue_id: gate.venueId,
        active_scene_id: null,
        active_playlist_id: playlist.id,
        activation_source: "manual",
        auto_event_id: null,
        auto_artist_id: null,
      },
      { onConflict: "venue_id" },
    );
    if (error) return { ok: false, message: sqlMessage(error.message) };
    await writeServerStationAudit(gate.writeClient, {
      venueId: gate.venueId,
      actor: gate.actor,
      action: "activate_playlist",
      detail: { playlistId: playlist.id, name: playlist.name },
    });
    revalidateServerStation();
    return { ok: true, message: `${playlist.name} is now on the LED wall.` };
  }

  if (!parsed.data.sceneId) return { ok: false, message: "Choose a scene." };

  const { data: scene } = await gate.writeClient
    .from("led_wall_scenes")
    .select("id, title, enabled, server_approved, kind, artist_id")
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", gate.venueId)
    .maybeSingle();

  if (!scene || !scene.enabled) return { ok: false, message: "That scene is not available." };
  if (scene.kind === "trivia" || scene.kind === "audience") {
    return { ok: false, message: "That scene is only for managers." };
  }
  if (
    gate.actor.role === "server" &&
    !isServerStationActivatableScene({
      enabled: scene.enabled,
      kind: scene.kind,
      server_approved: scene.server_approved,
      artist_id: scene.artist_id,
    })
  ) {
    return { ok: false, message: "That scene is not approved for servers." };
  }

  const { error } = await gate.writeClient.from("led_wall_runtime").upsert(
    {
      venue_id: gate.venueId,
      active_scene_id: scene.id,
      active_playlist_id: null,
      activation_source: "manual",
      auto_event_id: null,
      auto_artist_id: null,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlMessage(error.message) };

  await writeServerStationAudit(gate.writeClient, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "activate_scene",
    detail: { sceneId: scene.id, title: scene.title },
  });
  revalidateServerStation();
  return { ok: true, message: `LED wall switched to ${scene.title}.` };
}

export async function publishServerStationGraphicAction(input: unknown): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = z
    .object({
      kind: z.enum(["food_special", "drink_special", "birthday", "celebration", "message", "upload"]),
      celebrationType: z.enum(["birthday", "anniversary", "congratulations", "celebration"]).optional(),
      title: z.string().trim().min(1).max(120),
      subtitle: z.string().trim().max(120).optional().nullable(),
      price: z.string().trim().max(24).optional().nullable(),
      templateId: z.string().trim().max(40).optional(),
      publicUrl: z.string().url(),
      storagePath: z.string().trim().min(1).max(400),
      contentHash: z.string().trim().max(128).optional().nullable(),
      durationPreset: durationSchema.default("tonight"),
      mode: z.enum(["show_now", "add_rotation"]),
      photoUrl: z.string().url().optional().nullable(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const data = parsed.data;
  if (data.kind === "food_special" || data.kind === "drink_special") {
    const copy = validateSpecialCopy({
      itemName: data.title,
      price: data.price,
      description: data.subtitle,
    });
    if (!copy.ok) return { ok: false, message: copy.message };
  } else if (data.kind === "birthday" || data.kind === "celebration") {
    const name = validateGuestDisplayName(data.title);
    if (!name.ok) return { ok: false, message: name.message };
  } else if (data.kind === "message") {
    const message = validateServerStationMessage({
      headline: data.title,
      subtitle: data.subtitle,
    });
    if (!message.ok) return { ok: false, message: message.message };
  }

  const { settings } = await getServerStationSettings(gate.writeClient, gate.venueId);
  if (data.mode === "show_now" && !settings.show_now_enabled) {
    return { ok: false, message: "Show Now is turned off. Add to rotation instead." };
  }

  const needsApproval =
    settings.birthday_approval_required &&
    (data.kind === "birthday" || data.kind === "celebration" || data.celebrationType === "birthday");

  const endsAt = resolveServerStationEndsAt({
    preset: data.durationPreset as ServerStationDurationPreset,
    timeZone: gate.timeZone,
    businessNightEndHour: settings.business_night_end_hour,
  });

  const db = contentDb(gate);
  const sceneId = crypto.randomUUID();
  const title =
    data.kind === "birthday"
      ? `Happy Birthday ${data.title}`
      : data.kind === "celebration"
        ? `${(data.celebrationType || "celebration").replace(/^\w/, (c) => c.toUpperCase())} ${data.title}`
        : data.title;

  const { error: sceneError } = await db.from("led_wall_scenes").insert({
    id: sceneId,
    venue_id: gate.venueId,
    title: title.slice(0, 120),
    kind: "media",
    media_kind: "image",
    storage_path: data.storagePath,
    public_url: data.publicUrl,
    sort_order: await nextSceneSortOrder(db, gate.venueId),
    enabled: true,
    server_approved: false,
  });
  if (sceneError) return { ok: false, message: sqlMessage(sceneError.message) };

  if (data.contentHash) {
    await db.from("media_content_hashes").upsert(
      {
        venue_id: gate.venueId,
        asset_kind: "led_scene",
        asset_id: sceneId,
        sha256: data.contentHash,
        size_bytes: null,
        media_type: "image/png",
        storage_path: data.storagePath,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "asset_kind,asset_id" },
    );
  }

  let status: "active" | "queued" | "pending_approval" = needsApproval ? "pending_approval" : "active";
  let playlistItemId: string | null = null;
  let queued = false;
  let playsAfterCurrentAd = false;
  let campaignEnds = endsAt;

  if (needsApproval) {
    const { data: item, error: itemError } = await db
      .from("led_server_items")
      .insert({
        venue_id: gate.venueId,
        kind: data.kind === "celebration" ? "celebration" : data.kind,
        title: title.slice(0, 120),
        subtitle: data.subtitle ?? data.price ?? null,
        template_id: data.templateId || "classic",
        status,
        scene_id: sceneId,
        thumbnail_url: data.publicUrl,
        public_url: data.publicUrl,
        storage_path: data.storagePath,
        content_hash: data.contentHash ?? null,
        created_by: gate.actor.userId,
        created_by_name: gate.actor.displayName,
        device_id: gate.actor.deviceId,
        ends_at: endsAt,
        show_now: data.mode === "show_now",
      })
      .select("id")
      .single();
    if (itemError) return { ok: false, message: sqlMessage(itemError.message) };
    await writeServerStationAudit(db, {
      venueId: gate.venueId,
      actor: gate.actor,
      action: "content_pending_approval",
      detail: { itemId: item.id, title },
    });
    revalidateServerStation();
    return {
      ok: true,
      message: "Saved for manager approval before it goes on the wall.",
      itemId: item.id,
    };
  }

  if (data.mode === "show_now") {
    const protection = await getLedWallProtection(db, gate.venueId);
    if (protection.protected) {
      queued = true;
      status = "queued";
    } else {
      const hold = await readAdRollHold(db, gate.venueId);
      const playMs =
        (typeof data.durationPreset === "number"
          ? data.durationPreset
          : settings.default_override_minutes) * 60_000;
      const startsAt = hold?.startsAt ?? new Date().toISOString();
      let overrideEnds =
        data.durationPreset === "tonight" ? endsAt : new Date(Date.parse(startsAt) + playMs).toISOString();
      if (Date.parse(overrideEnds) <= Date.parse(startsAt)) {
        overrideEnds = new Date(Date.parse(startsAt) + playMs).toISOString();
      }
      if (data.durationPreset !== "tonight") campaignEnds = overrideEnds;
      playsAfterCurrentAd = Boolean(hold);

      const { data: runtime } = await db
        .from("led_wall_runtime")
        .select("active_scene_id, active_playlist_id, activation_source")
        .eq("venue_id", gate.venueId)
        .maybeSingle();

      // Single-row upsert prevents concurrent staff from stacking conflicting overrides.
      // starts_at in the future keeps the public view on the ad roll until that ad ends.
      const { error: overrideError } = await db.from("led_wall_overrides").upsert(
        {
          venue_id: gate.venueId,
          scene_id: sceneId,
          starts_at: startsAt,
          ends_at: overrideEnds,
          previous_scene_id: hold?.previousSceneId ?? runtime?.active_scene_id ?? null,
          previous_playlist_id: hold?.playlistId ?? runtime?.active_playlist_id ?? null,
          previous_activation_source: hold?.previousActivationSource ?? runtime?.activation_source ?? null,
          resume_playlist_item_id: hold?.resumePlaylistItemId ?? null,
          created_by: gate.actor.userId,
        },
        { onConflict: "venue_id" },
      );
      if (overrideError) return { ok: false, message: sqlMessage(overrideError.message) };

      // Leave the ad roll running until starts_at. Switching runtime now resets activated_at
      // and cuts the current ad. Maintenance promotes the override once it is actually due.
      if (!hold) {
        const { error: runtimeError } = await db.from("led_wall_runtime").upsert(
          {
            venue_id: gate.venueId,
            active_scene_id: sceneId,
            active_playlist_id: null,
            activation_source: "server_override",
            auto_event_id: null,
            auto_artist_id: null,
          },
          { onConflict: "venue_id" },
        );
        if (runtimeError) return { ok: false, message: sqlMessage(runtimeError.message) };
      }
    }
  }

  if (data.mode === "add_rotation" || queued) {
    const playlistId = await resolveTemporaryPlaylistId(
      db,
      gate.venueId,
      settings.temporary_playlist_id,
    );
    if (!playlistId) {
      return {
        ok: false,
        message: "No house playlist is configured for temporary slides. Ask an admin.",
      };
    }

    const inserted = await insertServerSlideAfterCurrentAd(db, {
      venueId: gate.venueId,
      playlistId,
      sceneId,
      durationSeconds: settings.default_slide_seconds,
    });
    if (!inserted.ok) return { ok: false, message: sqlMessage(inserted.message) };
    playlistItemId = inserted.playlistItemId;
    playsAfterCurrentAd = playsAfterCurrentAd || inserted.playsAfterCurrentAd;
    status = queued ? "queued" : "active";
  }

  const { data: item, error: itemError } = await db
    .from("led_server_items")
    .insert({
      venue_id: gate.venueId,
      kind: data.kind === "celebration" ? "celebration" : data.kind,
      title: title.slice(0, 120),
      subtitle: data.subtitle ?? data.price ?? null,
      template_id: data.templateId || SERVER_STATION_TEMPLATES[0].id,
      status,
      scene_id: sceneId,
      playlist_item_id: playlistItemId,
      thumbnail_url: data.publicUrl,
      public_url: data.publicUrl,
      storage_path: data.storagePath,
      content_hash: data.contentHash ?? null,
      created_by: gate.actor.userId,
      created_by_name: gate.actor.displayName,
      device_id: gate.actor.deviceId,
      ends_at: campaignEnds,
      show_now: data.mode === "show_now" && !queued,
    })
    .select("id")
    .single();
  if (itemError) return { ok: false, message: sqlMessage(itemError.message) };

  if (data.mode === "show_now" && !queued) {
    await db
      .from("led_wall_overrides")
      .update({ server_item_id: item.id })
      .eq("venue_id", gate.venueId);
  }

  await writeServerStationAudit(db, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: queued ? "content_queued" : data.mode === "show_now" ? "content_show_now" : "content_rotation",
    detail: {
      itemId: item.id,
      title,
      duration: durationPresetLabel(data.durationPreset as ServerStationDurationPreset),
    },
  });

  revalidateServerStation();

  if (queued) {
    return {
      ok: true,
      message: "The show is protected right now, so this was added to the rotation instead.",
      queued: true,
      itemId: item.id,
    };
  }
  const durationLabel = durationPresetLabel(data.durationPreset as ServerStationDurationPreset);
  if (data.mode === "show_now") {
    return {
      ok: true,
      message: playsAfterCurrentAd
        ? `The current ad will finish, then this goes on the wall (${durationLabel}).`
        : `Showing on the LED wall now (${durationLabel}).`,
      itemId: item.id,
    };
  }
  return {
    ok: true,
    message: playsAfterCurrentAd
      ? `Added next in the rotation. The current ad will finish first. It stays up until ${durationLabel.toLowerCase()}.`
      : `Added to the LED rotation until ${durationLabel.toLowerCase()}.`,
    itemId: item.id,
  };
}

export async function listActiveServerStationItemsAction() {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false as const, message: gate.message, items: [] };

  const db = contentDb(gate);
  const itemSelect =
    "id, kind, title, subtitle, status, thumbnail_url, created_by_name, ends_at, show_now, created_at, playlist_item_id, scene_id";
  const [{ data, error }, overrideRes, stuckRes] = await Promise.all([
    db
      .from("led_server_items")
      .select(itemSelect)
      .eq("venue_id", gate.venueId)
      .in("status", ["active", "queued", "pending_approval"])
      .order("created_at", { ascending: false })
      .limit(40),
    db
      .from("led_wall_overrides")
      .select("server_item_id, scene_id, starts_at, ends_at")
      .eq("venue_id", gate.venueId)
      .maybeSingle(),
    db
      .from("led_server_items")
      .select(itemSelect)
      .eq("venue_id", gate.venueId)
      .in("status", ["expired", "removed"])
      .order("created_at", { ascending: false })
      .limit(16),
  ]);

  if (error) return { ok: false as const, message: sqlMessage(error.message), items: [] };
  let override = overrideRes.data;
  if (overrideRes.error && /starts_at|resume_playlist_item_id/i.test(overrideRes.error.message)) {
    const basic = await db
      .from("led_wall_overrides")
      .select("server_item_id, scene_id, ends_at")
      .eq("venue_id", gate.venueId)
      .maybeSingle();
    if (basic.error) return { ok: false as const, message: sqlMessage(basic.error.message), items: [] };
    override = basic.data ? { ...basic.data, starts_at: new Date(0).toISOString() } : null;
  } else if (overrideRes.error) {
    return { ok: false as const, message: sqlMessage(overrideRes.error.message), items: [] };
  }

  const listed = new Map((data ?? []).map((item) => [item.id, item]));
  const stuckCandidates = (stuckRes.data ?? []).filter((item) => item.scene_id && !listed.has(item.id));
  const stuckSceneIds = [...new Set(stuckCandidates.map((item) => item.scene_id).filter((id): id is string => Boolean(id)))];
  const liveScenes = new Set<string>();
  if (override?.scene_id) liveScenes.add(override.scene_id);
  if (stuckSceneIds.length > 0) {
    const { data: liveRows } = await db
      .from("led_wall_playlist_items")
      .select("scene_id")
      .eq("venue_id", gate.venueId)
      .eq("enabled", true)
      .is("archived_at", null)
      .in("scene_id", stuckSceneIds);
    for (const row of liveRows ?? []) {
      if (row.scene_id) liveScenes.add(row.scene_id);
    }
  }
  for (const item of stuckCandidates) {
    if (item.scene_id && liveScenes.has(item.scene_id)) listed.set(item.id, item);
  }

  const items = [...listed.values()].map((item) => ({
    ...item,
    override_starts_at:
      override &&
      item.show_now &&
      (override.server_item_id === item.id || override.scene_id === item.scene_id)
        ? override.starts_at
        : null,
  }));
  return { ok: true as const, items };
}

export async function removeServerStationItemAction(input: unknown): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose an item to remove." };

  const db = contentDb(gate);
  const { data: item } = await db
    .from("led_server_items")
    .select("id, playlist_item_id, scene_id, created_by, title, kind")
    .eq("id", parsed.data.itemId)
    .eq("venue_id", gate.venueId)
    .maybeSingle();
  if (!item) return { ok: false, message: "That item is gone." };

  const nowIso = new Date().toISOString();
  const venueId = gate.venueId;
  const playlistIds = new Set<string>();
  const beforeByPlaylist = new Map<string, Awaited<ReturnType<typeof loadAdRollItems>>["items"]>();

  async function retirePlaylistItem(playlistItemId: string) {
    const { data: membership, error: membershipError } = await db
      .from("led_wall_playlist_items")
      .select("playlist_id")
      .eq("id", playlistItemId)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (membershipError) return membershipError.message;
    const playlistId = membership?.playlist_id;
    if (playlistId && !beforeByPlaylist.has(playlistId)) {
      beforeByPlaylist.set(playlistId, (await loadAdRollItems(db, venueId, playlistId)).items);
      playlistIds.add(playlistId);
    }
    const { error: disableError } = await db
      .from("led_wall_playlist_items")
      .update({ enabled: false, archived_at: nowIso })
      .eq("id", playlistItemId)
      .eq("venue_id", venueId);
    return disableError?.message ?? null;
  }

  if (item.playlist_item_id) {
    const disableError = await retirePlaylistItem(item.playlist_item_id);
    if (disableError) return { ok: false, message: sqlMessage(disableError) };
  }
  if (item.scene_id) {
    const { data: siblings, error: siblingError } = await db
      .from("led_wall_playlist_items")
      .select("id")
      .eq("venue_id", gate.venueId)
      .eq("scene_id", item.scene_id)
      .eq("enabled", true);
    if (siblingError) return { ok: false, message: sqlMessage(siblingError.message) };
    for (const sibling of siblings ?? []) {
      const disableError = await retirePlaylistItem(sibling.id);
      if (disableError) return { ok: false, message: sqlMessage(disableError) };
    }
  }
  for (const playlistId of playlistIds) {
    await rebaseLiveAdRoll(db, gate.venueId, playlistId, beforeByPlaylist.get(playlistId) ?? []);
  }

  const overrideSelect = await db
    .from("led_wall_overrides")
    .select(
      "scene_id, starts_at, previous_playlist_id, previous_scene_id, previous_activation_source, resume_playlist_item_id",
    )
    .eq("venue_id", gate.venueId)
    .maybeSingle();
  let override = overrideSelect.data;
  if (overrideSelect.error && /starts_at|resume_playlist_item_id/i.test(overrideSelect.error.message)) {
    const basic = await db
      .from("led_wall_overrides")
      .select("scene_id, previous_playlist_id, previous_scene_id, previous_activation_source")
      .eq("venue_id", gate.venueId)
      .maybeSingle();
    if (basic.error) return { ok: false, message: sqlMessage(basic.error.message) };
    override = basic.data
      ? { ...basic.data, starts_at: new Date(0).toISOString(), resume_playlist_item_id: null }
      : null;
  } else if (overrideSelect.error) {
    return { ok: false, message: sqlMessage(overrideSelect.error.message) };
  }

  const { data: runtime } = await db
    .from("led_wall_runtime")
    .select("active_scene_id, activation_source")
    .eq("venue_id", gate.venueId)
    .maybeSingle();
  const showingThisScene =
    Boolean(item.scene_id) &&
    runtime?.active_scene_id === item.scene_id &&
    runtime?.activation_source === "server_override";
  if ((override?.scene_id && override.scene_id === item.scene_id) || showingThisScene) {
    const stillWaiting = override?.starts_at ? Date.parse(override.starts_at) > Date.now() : false;
    const { error: clearError } = await db.from("led_wall_overrides").delete().eq("venue_id", gate.venueId);
    if (clearError) return { ok: false, message: sqlMessage(clearError.message) };
    if (!stillWaiting) {
      await restoreAdRollAfterOverride(
        db,
        gate.venueId,
        override ?? {
          previous_playlist_id: null,
          previous_scene_id: null,
          previous_activation_source: null,
          resume_playlist_item_id: null,
        },
      );
    }
  }

  const { error: removedError } = await db
    .from("led_server_items")
    .update({ status: "removed" })
    .eq("id", item.id)
    .eq("venue_id", gate.venueId);
  if (removedError) return { ok: false, message: sqlMessage(removedError.message) };

  await writeServerStationAudit(db, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "content_removed",
    detail: { itemId: item.id, title: item.title, kind: item.kind },
  });
  revalidateServerStation();
  return { ok: true, message: `Removed ${item.title} from the LED wall.` };
}

export async function extendServerStationItemAction(input: unknown): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      durationPreset: durationSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose how long to extend." };

  const db = contentDb(gate);
  const { settings } = await getServerStationSettings(db, gate.venueId);
  const endsAt = resolveServerStationEndsAt({
    preset: parsed.data.durationPreset as ServerStationDurationPreset,
    timeZone: gate.timeZone,
    businessNightEndHour: settings.business_night_end_hour,
  });

  const { data: item, error } = await db
    .from("led_server_items")
    .update({ ends_at: endsAt, status: "active" })
    .eq("id", parsed.data.itemId)
    .eq("venue_id", gate.venueId)
    .in("status", ["active", "queued", "expired"])
    .select("id, title, playlist_item_id")
    .maybeSingle();
  if (error) return { ok: false, message: sqlMessage(error.message) };
  if (!item) return { ok: false, message: "That item is not available." };

  if (item.playlist_item_id) {
    const { data: membership } = await db
      .from("led_wall_playlist_items")
      .select("playlist_id")
      .eq("id", item.playlist_item_id)
      .eq("venue_id", gate.venueId)
      .maybeSingle();
    const before = membership?.playlist_id
      ? (await loadAdRollItems(db, gate.venueId, membership.playlist_id)).items
      : [];
    await db
      .from("led_wall_playlist_items")
      .update({ enabled: true, archived_at: null })
      .eq("id", item.playlist_item_id)
      .eq("venue_id", gate.venueId);
    if (membership?.playlist_id) {
      await rebaseLiveAdRoll(db, gate.venueId, membership.playlist_id, before);
    }
  }

  await writeServerStationAudit(db, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "content_extended",
    detail: { itemId: item.id, endsAt },
  });
  revalidateServerStation();
  return {
    ok: true,
    message: `Extended ${item.title} (${durationPresetLabel(parsed.data.durationPreset as ServerStationDurationPreset)}).`,
  };
}

export async function issueServerStationUploadSessionAction(input?: {
  workflow?: "upload" | "special" | "birthday" | "message";
}): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false, message: gate.message };

  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashDisplaySecret(token);
  const expiresAt = new Date(Date.now() + SERVER_STATION_UPLOAD_TTL_SECONDS * 1000).toISOString();
  const workflow = input?.workflow ?? "upload";

  const { data, error } = await gate.writeClient
    .from("server_station_upload_sessions")
    .insert({
      venue_id: gate.venueId,
      device_id: gate.actor.deviceId,
      created_by: gate.actor.userId,
      workflow,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: sqlMessage(error.message) };

  const uploadUrl = joinPublicUrl(getPublicAppUrl(), `/server/upload/phone?t=${token}`);
  return {
    ok: true,
    message: "Scan with your phone to upload a picture.",
    uploadUrl,
    sessionId: data.id,
    expiresAt,
  };
}

export async function pollServerStationUploadSessionAction(input: unknown) {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false as const, message: gate.message };
  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Missing upload session." };

  const { data, error } = await gate.writeClient
    .from("server_station_upload_sessions")
    .select(
      "id, expires_at, uploaded_url, uploaded_storage_path, uploaded_media_kind, uploaded_content_hash, uploaded_at, consumed_at",
    )
    .eq("id", parsed.data.sessionId)
    .eq("venue_id", gate.venueId)
    .maybeSingle();
  if (error) return { ok: false as const, message: sqlMessage(error.message) };
  if (!data) return { ok: false as const, message: "Upload session not found." };
  if (Date.parse(data.expires_at) <= Date.now() && !data.uploaded_url) {
    return { ok: false as const, message: "This upload QR expired. Create a new one." };
  }

  return {
    ok: true as const,
    uploaded: Boolean(data.uploaded_url),
    url: data.uploaded_url,
    storagePath: data.uploaded_storage_path,
    mediaKind: data.uploaded_media_kind,
    contentHash: data.uploaded_content_hash,
    uploadedAt: data.uploaded_at,
  };
}

export async function updateServerStationSettingsAction(input: unknown): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("configure");
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = z
    .object({
      showNowEnabled: z.boolean(),
      birthdayApprovalRequired: z.boolean(),
      temporaryPlaylistId: z.string().uuid().nullable(),
      defaultSlideSeconds: z.number().int().min(5).max(120),
      defaultOverrideMinutes: z.number().int().min(1).max(120),
      maxUploadBytes: z.number().int().min(1_000_000).max(50_000_000),
      businessNightEndHour: z.number().int().min(0).max(6),
      staffIdleSeconds: z.number().int().min(30).max(3600),
      approvedSceneIds: z.array(z.string().uuid()).default([]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the Server Station settings." };

  const { error } = await gate.writeClient.from("server_station_settings").upsert(
    {
      venue_id: gate.venueId,
      show_now_enabled: parsed.data.showNowEnabled,
      birthday_approval_required: parsed.data.birthdayApprovalRequired,
      temporary_playlist_id: parsed.data.temporaryPlaylistId,
      default_slide_seconds: parsed.data.defaultSlideSeconds,
      default_override_minutes: parsed.data.defaultOverrideMinutes,
      max_upload_bytes: parsed.data.maxUploadBytes,
      business_night_end_hour: parsed.data.businessNightEndHour,
      staff_idle_seconds: parsed.data.staffIdleSeconds,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlMessage(error.message) };

  // Artist scenes are always available to servers; only house scenes use server_approved.
  await gate.writeClient
    .from("led_wall_scenes")
    .update({ server_approved: false })
    .eq("venue_id", gate.venueId)
    .is("artist_id", null);

  if (parsed.data.approvedSceneIds.length) {
    await gate.writeClient
      .from("led_wall_scenes")
      .update({ server_approved: true })
      .eq("venue_id", gate.venueId)
      .is("artist_id", null)
      .in("id", parsed.data.approvedSceneIds);
  }

  await writeServerStationAudit(gate.writeClient, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "settings_updated",
  });
  revalidateServerStation();
  return { ok: true, message: "Server Station settings saved." };
}

export async function cancelServerStationOverrideAction(): Promise<ServerStationActionResult> {
  const gate = await getServerStationGate("content");
  if (!gate.ok) return { ok: false, message: gate.message };
  if (gate.actor.role === "server") {
    // Servers can cancel overrides they created via remove; managers/admins cancel freely.
  }

  const db = contentDb(gate);
  const { data: override } = await db
    .from("led_wall_overrides")
    .select(
      "starts_at, previous_playlist_id, previous_scene_id, previous_activation_source, resume_playlist_item_id",
    )
    .eq("venue_id", gate.venueId)
    .maybeSingle();
  const stillWaiting = override ? Date.parse(override.starts_at) > Date.now() : false;
  await db.from("led_wall_overrides").delete().eq("venue_id", gate.venueId);
  if (override && !stillWaiting) {
    await restoreAdRollAfterOverride(db, gate.venueId, override);
  }
  await writeServerStationAudit(db, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "override_cancelled",
  });
  revalidateServerStation();
  return { ok: true, message: "Temporary wall override cleared." };
}

/** Called from LED cron — expires overrides and temporary slides. */
export async function runServerStationMaintenance(venueId: string) {
  const admin = createServiceRoleClient();
  if (!admin) return { overridesCleared: false, itemsExpired: 0 };
  const cleared = await clearExpiredLedOverride(admin, venueId);
  const { expireServerStationItems } = await import("@/lib/server-station/overrides");
  const { promoteDueServerStationOverride } = await import("@/lib/server-station/overrides");
  await promoteDueServerStationOverride(admin, venueId);
  const expired = await expireServerStationItems(admin, venueId);
  return {
    overridesCleared: Boolean(cleared.cleared),
    itemsExpired: expired.removed,
  };
}
