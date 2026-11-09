import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FLO_BAMA_VENUE_ID, DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { recordMcpAudit } from "@/lib/mcp/audit";
import { liveChangePreview, requiresConfirm } from "@/lib/mcp/confirm";
import { listArtists } from "@/lib/queries/artists";
import { listEvents, getEventById, artistNames } from "@/lib/queries/events";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import { getLedWallAgentStatus, getLedWallRuntime, listLedWallScenes } from "@/lib/queries/led-wall";
import { listStaffLedPlaylists } from "@/lib/queries/led-playlists";
import { listStaffMenuSpecials } from "@/lib/queries/playlists";
import { listTodayLedListings } from "@/lib/queries/artist-led";
import { getStaffTriviaSession, listTriviaPacks } from "@/lib/queries/trivia";
import { listPreloadPins, preloadReportSummary, listPreloadReports } from "@/lib/screens/led-preload-data";
import { eventWriteFieldsFromForm, syncEventArtists } from "@/lib/events/persist";
import { pickDefaultArtistScene } from "@/lib/screens/artist-led";
import { endTriviaSession, startTriviaSession } from "@/lib/trivia/runtime";
import { artistFormSchema, eventFormSchema } from "@/lib/validation/schemas";
import {
  EVENT_TYPES,
  TRIVIA_DEFAULT_LOBBY_SECONDS,
  TRIVIA_DEFAULT_QUESTION_COUNT,
  TRIVIA_DEFAULT_QUESTION_SECONDS,
} from "@/lib/constants";

export type McpClient = SupabaseClient;

export type McpDeps = {
  client: McpClient;
  venueId?: string;
  actor?: string;
  now?: Date;
};

type ToolResult = Record<string, unknown>;

const confirmField = z.boolean().optional().describe("Required true to apply a live or destructive change. Omit it to preview.");
const actorField = z.string().trim().max(80).optional().describe("Short note stored in the audit log, such as grok. The token itself is never stored.");

function venueId(deps: McpDeps) {
  return deps.venueId ?? FLO_BAMA_VENUE_ID;
}

function actorOf(deps: McpDeps, note?: string) {
  const extra = note?.trim();
  return extra ? `mcp:${extra}` : deps.actor?.trim() || "mcp";
}

function textError(message: string): ToolResult {
  return { ok: false, message };
}

async function venueClock(client: McpClient, id: string) {
  const { data } = await client.from("venues").select("name, timezone").eq("id", id).maybeSingle();
  return {
    name: data?.name ?? "FloBama",
    timeZone: data?.timezone?.trim() || DEFAULT_VENUE_TIMEZONE,
  };
}

async function audited(
  deps: McpDeps,
  toolName: string,
  input: Record<string, unknown>,
  previewOnly: boolean,
  message: string,
  run?: () => Promise<ToolResult>,
): Promise<ToolResult> {
  const logged = await recordMcpAudit(deps.client, {
    venueId: venueId(deps),
    toolName,
    actor: actorOf(deps, typeof input.actor === "string" ? input.actor : undefined),
    previewOnly,
    input,
    ok: previewOnly ? true : null,
    message: previewOnly ? message : "started",
  });
  if (!logged.ok) return textError(logged.message);
  if (previewOnly) return run ? run() : { ok: true, preview: true, message };
  if (!run) return textError("Nothing to change.");
  const result = await run();
  await deps.client
    .from("mcp_audit_log" as never)
    .update({ ok: result.ok !== false, message: String(result.message ?? "") } as never)
    .eq("id" as never, logged.id as never);
  return result;
}

async function listEventsTool(args: { query?: string; window?: "upcoming" | "past" | "cancelled" }, deps: McpDeps) {
  const id = venueId(deps);
  const clock = await venueClock(deps.client, id);
  const now = (deps.now ?? new Date()).toISOString();
  const result = await listEvents(
    deps.client,
    id,
    {
      window: args.window ?? "upcoming",
      query: args.query ?? "",
      status: "all",
      eventType: "all",
      fromDate: null,
      toDate: null,
      page: 1,
      pageSize: 20,
      timeZone: clock.timeZone,
    },
    now,
  );
  if (result.error) return textError(result.error);
  return {
    ok: true,
    timeZone: clock.timeZone,
    events: result.events.map((event) => ({
      id: event.id,
      title: event.title,
      status: event.status,
      eventType: event.event_type,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      artists: artistNames(event),
    })),
  };
}

async function getEventTool(args: { eventId: string }, deps: McpDeps) {
  const result = await getEventById(deps.client, args.eventId);
  if (result.error) return textError(result.error);
  if (!result.event || result.event.venue_id !== venueId(deps)) return textError("Event not found.");
  const event = result.event;
  return {
    ok: true,
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      visibility: event.visibility,
      eventType: event.event_type,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      locationLabel: event.location_label,
      publicDescription: event.public_description,
      artists: artistNames(event),
      artistIds: event.event_artists.map((row) => row.artist_id),
    },
  };
}

async function listArtistsTool(args: { query?: string }, deps: McpDeps) {
  const result = await listArtists(deps.client, venueId(deps), {
    query: args.query ?? "",
    includeArchived: false,
    page: 1,
    pageSize: 30,
  });
  if (result.error) return textError(result.error);
  return {
    ok: true,
    artists: result.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      genre: artist.genre,
    })),
  };
}

async function listWallScenesTool(_args: Record<string, never>, deps: McpDeps) {
  const result = await listLedWallScenes(deps.client, venueId(deps));
  if (result.error) return textError(result.error);
  return {
    ok: true,
    scenes: result.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      kind: scene.kind,
      mediaKind: scene.media_kind,
      enabled: scene.enabled,
      artistId: scene.artist_id,
    })),
  };
}

async function wallStatusTool(_args: Record<string, never>, deps: McpDeps) {
  const id = venueId(deps);
  const [runtime, agent, devices, pins, reports] = await Promise.all([
    getLedWallRuntime(deps.client, id),
    getLedWallAgentStatus(deps.client, id),
    listStaffDisplayDevices(deps.client, id),
    listPreloadPins(deps.client, id),
    listPreloadReports(deps.client, id),
  ]);
  return {
    ok: true,
    live: runtime.runtime
      ? {
          sceneId: runtime.runtime.active_scene_id,
          playlistId: runtime.runtime.active_playlist_id,
          source: runtime.runtime.activation_source,
        }
      : null,
    localRunner: {
      lastSeenAt: agent.agent.lastSeenAt,
      obsConnected: agent.agent.obsConnected,
      programScene: agent.agent.programScene,
      devices: devices.devices
        .filter((device) => !device.revoked_at)
        .map((device) => ({
          id: device.id,
          label: device.label,
          kind: device.kind,
          lastSeenAt: device.last_seen_at,
          appVersion: device.app_version,
          obsConnected: device.status?.obs_connected ?? null,
          assetsReady: device.status?.assets_ready ?? null,
          assetsPending: device.status?.assets_pending ?? null,
          lastError: device.status?.last_error ?? null,
        })),
    },
    preload: {
      pinnedSceneIds: pins.sceneIds,
      reports: preloadReportSummary(reports.reports),
    },
  };
}

async function todayScheduleTool(_args: Record<string, never>, deps: McpDeps) {
  const id = venueId(deps);
  const clock = await venueClock(deps.client, id);
  const result = await listTodayLedListings(deps.client, id, clock.timeZone, deps.now ?? new Date());
  if (result.error && !result.missingColumn) return textError(result.error);
  return {
    ok: true,
    timeZone: clock.timeZone,
    shows: result.listings.map((listing) => ({
      eventId: listing.eventId,
      title: listing.title,
      startsAt: listing.startsAt,
      endsAt: listing.endsAt,
      artists: listing.artists.map((artist) => ({
        artistId: artist.artistId,
        name: artist.name,
        sceneId: artist.sceneId,
        enabled: artist.enabled,
      })),
    })),
  };
}

async function triviaStatusTool(_args: Record<string, never>, deps: McpDeps) {
  const [packs, session] = await Promise.all([
    listTriviaPacks(deps.client, venueId(deps)),
    getStaffTriviaSession(deps.client, venueId(deps)),
  ]);
  return {
    ok: true,
    packs: packs.packs.map((pack) => ({ id: pack.id, title: pack.title, theme: pack.theme, enabled: pack.enabled })),
    session: session.session
      ? {
          id: session.session.id,
          joinCode: session.session.joinCode,
          status: session.session.status,
          questionIndex: session.session.currentQuestionIndex,
          questionCount: session.session.questionCount,
        }
      : null,
  };
}

async function listSpecialsTool(_args: Record<string, never>, deps: McpDeps) {
  const result = await listStaffMenuSpecials(deps.client, venueId(deps));
  if (result.error) return textError(result.error);
  return {
    ok: true,
    specials: result.specials.map((special) => ({
      id: special.id,
      title: special.title,
      category: special.category,
      priceLabel: special.price_label,
      enabled: special.enabled,
    })),
  };
}

async function listLedPlaylistsTool(_args: Record<string, never>, deps: McpDeps) {
  const result = await listStaffLedPlaylists(deps.client, venueId(deps));
  if (result.error) return textError(result.error);
  return {
    ok: true,
    playlists: result.playlists.map((playlist) => ({ id: playlist.id, name: playlist.name })),
  };
}

async function currentSceneLabel(client: McpClient, id: string) {
  const runtime = await getLedWallRuntime(client, id);
  const sceneId = runtime.runtime?.active_scene_id;
  if (!sceneId) return runtime.runtime?.active_playlist_id ? "A playlist is live." : "Nothing is live.";
  const { data } = await client.from("led_wall_scenes").select("title").eq("id", sceneId).eq("venue_id", id).maybeSingle();
  return data?.title ? `${data.title} is live.` : "A scene is live.";
}

async function activateScene(
  deps: McpDeps,
  scene: { id: string; title: string; kind: string },
  extra: { eventId?: string | null; artistId?: string | null },
) {
  const id = venueId(deps);
  if (scene.kind === "trivia") {
    const packId = (await listTriviaPacks(deps.client, id)).packs.find((pack) => pack.enabled)?.id;
    if (!packId) return textError("No enabled trivia pack.");
    const started = await startTriviaSession(deps.client, {
      venueId: id,
      packId,
      questionCount: TRIVIA_DEFAULT_QUESTION_COUNT,
      lobbySeconds: TRIVIA_DEFAULT_LOBBY_SECONDS,
      questionSeconds: TRIVIA_DEFAULT_QUESTION_SECONDS,
      startedBy: null,
    });
    if (!started.ok && !/already running/i.test(started.message)) return textError(started.message);
  } else {
    await endTriviaSession(deps.client, id);
  }
  const { error } = await deps.client.from("led_wall_runtime").upsert(
    {
      venue_id: id,
      active_scene_id: scene.id,
      active_playlist_id: null,
      activation_source: "manual",
      auto_event_id: extra.eventId ?? null,
      auto_artist_id: extra.artistId ?? null,
    },
    { onConflict: "venue_id" },
  );
  if (error) return textError(error.message);
  return { ok: true, message: `${scene.title} is now the live LED scene.` };
}

async function putSceneOnWall(args: { sceneId: string; confirm?: boolean; actor?: string }, deps: McpDeps) {
  const id = venueId(deps);
  const { data: scene, error } = await deps.client
    .from("led_wall_scenes")
    .select("id, title, enabled, kind")
    .eq("id", args.sceneId)
    .eq("venue_id", id)
    .maybeSingle();
  if (error) return textError(error.message);
  if (!scene || !scene.enabled) return textError("That scene is not available.");
  const current = await currentSceneLabel(deps.client, id);
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: `Put “${scene.title}” on the LED wall.`,
      current,
      next: `${scene.title} becomes the live scene. This does not preload; it changes the wall.`,
    });
    return audited(deps, "put_scene_on_wall", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "put_scene_on_wall", args, false, `${scene.title} is now live.`, () =>
    activateScene(deps, scene, {}),
  );
}

async function putArtistOnWall(
  args: { artistId: string; sceneId?: string; eventId?: string; confirm?: boolean; actor?: string },
  deps: McpDeps,
) {
  const id = venueId(deps);
  const { data, error } = await deps.client
    .from("led_wall_scenes")
    .select("id, title, enabled, is_default, sort_order")
    .eq("venue_id", id)
    .eq("artist_id", args.artistId);
  if (error) return textError(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    enabled: boolean;
    is_default?: boolean | null;
    sort_order?: number | null;
  }>;
  const picked = args.sceneId
    ? rows.find((row) => row.id === args.sceneId && row.enabled)
    : pickDefaultArtistScene(rows);
  if (!picked || !picked.enabled) return textError("That artist does not have an active LED graphic yet.");
  const current = await currentSceneLabel(deps.client, id);
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: `Put “${picked.title}” on the LED wall.`,
      current,
      next: `${picked.title} becomes the live scene.`,
    });
    return audited(deps, "put_artist_on_wall", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "put_artist_on_wall", args, false, `${picked.title} is now live.`, () =>
    activateScene(deps, { ...picked, kind: "media" }, { artistId: args.artistId, eventId: args.eventId ?? null }),
  );
}

async function activatePlaylist(args: { playlistId: string; confirm?: boolean; actor?: string }, deps: McpDeps) {
  const id = venueId(deps);
  const { data: playlist, error } = await deps.client
    .from("led_wall_playlists")
    .select("id, name")
    .eq("id", args.playlistId)
    .eq("venue_id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) return textError(error.message);
  if (!playlist) return textError("That playlist is not available.");
  const current = await currentSceneLabel(deps.client, id);
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: `Start the “${playlist.name}” playlist on the LED wall.`,
      current,
      next: `${playlist.name} replaces the current picture.`,
    });
    return audited(deps, "activate_led_playlist", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "activate_led_playlist", args, false, `${playlist.name} is now live.`, async () => {
    await endTriviaSession(deps.client, id);
    const { error: upsertError } = await deps.client.from("led_wall_runtime").upsert(
      {
        venue_id: id,
        active_scene_id: null,
        active_playlist_id: playlist.id,
        activation_source: "manual",
        auto_event_id: null,
        auto_artist_id: null,
      },
      { onConflict: "venue_id" },
    );
    if (upsertError) return textError(upsertError.message);
    return { ok: true, message: `${playlist.name} is now the live playlist.` };
  });
}

async function saveEventTool(args: Record<string, unknown> & { eventId?: string; actor?: string }, deps: McpDeps) {
  const id = venueId(deps);
  const clock = await venueClock(deps.client, id);
  const parsed = eventFormSchema.safeParse({
    featured: false,
    isTicketed: false,
    artistIds: [],
    visibility: "public",
    ...args,
    timeZone: typeof args.timeZone === "string" && args.timeZone ? args.timeZone : clock.timeZone,
  });
  if (!parsed.success) return textError(parsed.error.issues[0]?.message ?? "Check the event fields.");
  const built = eventWriteFieldsFromForm(parsed.data);
  if (!built.ok) return textError(built.message);
  return audited(deps, "save_event", { ...args, publicDescription: undefined }, false, "Event saved.", async () => {
    let eventId = args.eventId;
    if (eventId) {
      const existing = await getEventById(deps.client, eventId);
      if (!existing.event || existing.event.venue_id !== id) return textError("Event not found.");
      const { error } = await deps.client.from("events").update(built.fields).eq("id", eventId).eq("venue_id", id);
      if (error) return textError(error.message);
    } else {
      const { data, error } = await deps.client
        .from("events")
        .insert({ ...built.fields, venue_id: id })
        .select("id")
        .single();
      if (error || !data) return textError(error?.message ?? "Could not create the event.");
      eventId = data.id;
    }
    const artists = await syncEventArtists(deps.client, id, eventId!, parsed.data.artistIds);
    if (!artists.ok) return textError(artists.message);
    return { ok: true, message: args.eventId ? "Event saved." : "Event created.", id: eventId };
  });
}

async function setEventStatusTool(
  args: { eventId: string; status: "draft" | "published" | "cancelled"; actor?: string },
  deps: McpDeps,
) {
  return audited(deps, "set_event_status", args, false, `Status set to ${args.status}.`, async () => {
    const { error } = await deps.client
      .from("events")
      .update({ status: args.status })
      .eq("id", args.eventId)
      .eq("venue_id", venueId(deps))
      .is("archived_at", null);
    if (error) return textError(error.message);
    return { ok: true, message: `Event is now ${args.status}.`, id: args.eventId };
  });
}

async function archiveEventTool(args: { eventId: string; confirm?: boolean; actor?: string }, deps: McpDeps) {
  const existing = await getEventById(deps.client, args.eventId);
  if (!existing.event || existing.event.venue_id !== venueId(deps)) return textError("Event not found.");
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: `Archive “${existing.event.title}”.`,
      current: `${existing.event.title} is ${existing.event.status}.`,
      next: "The event leaves the active calendar. This does not delete the row.",
    });
    return audited(deps, "archive_event", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "archive_event", args, false, "Event archived.", async () => {
    const { error } = await deps.client
      .from("events")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", args.eventId)
      .eq("venue_id", venueId(deps));
    if (error) return textError(error.message);
    return { ok: true, message: "Event archived." };
  });
}

async function saveArtistTool(args: Record<string, unknown> & { artistId?: string }, deps: McpDeps) {
  const parsed = artistFormSchema.safeParse(args);
  if (!parsed.success) return textError(parsed.error.issues[0]?.message ?? "Check the artist fields.");
  const fields = {
    name: parsed.data.name,
    genre: parsed.data.genre,
    bio: parsed.data.bio,
    website_url: parsed.data.websiteUrl,
  };
  return audited(deps, "save_artist", { artistId: args.artistId, name: fields.name }, false, "Artist saved.", async () => {
    if (args.artistId) {
      const { error } = await deps.client
        .from("artists")
        .update(fields)
        .eq("id", args.artistId)
        .eq("venue_id", venueId(deps));
      if (error) return textError(error.message);
      return { ok: true, message: "Artist saved.", id: args.artistId };
    }
    const { data, error } = await deps.client
      .from("artists")
      .insert({ ...fields, venue_id: venueId(deps) })
      .select("id")
      .single();
    if (error || !data) return textError(error?.message ?? "Could not create the artist.");
    return { ok: true, message: "Artist created.", id: data.id };
  });
}

async function archiveArtistTool(args: { artistId: string; confirm?: boolean; actor?: string }, deps: McpDeps) {
  const { data, error } = await deps.client
    .from("artists")
    .select("id, name")
    .eq("id", args.artistId)
    .eq("venue_id", venueId(deps))
    .maybeSingle();
  if (error) return textError(error.message);
  if (!data) return textError("Artist not found.");
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: `Archive ${data.name}.`,
      current: `${data.name} is on the artist list.`,
      next: "The artist is hidden from the active list. Events that already link them stay as they are.",
    });
    return audited(deps, "archive_artist", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "archive_artist", args, false, "Artist archived.", async () => {
    const { error: updateError } = await deps.client
      .from("artists")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", args.artistId)
      .eq("venue_id", venueId(deps));
    if (updateError) return textError(updateError.message);
    return { ok: true, message: "Artist archived." };
  });
}

async function pinPreload(args: { sceneId: string; actor?: string }, deps: McpDeps, release: boolean) {
  const id = venueId(deps);
  const { data: scene, error } = await deps.client
    .from("led_wall_scenes")
    .select("id, title, enabled, kind, media_kind, public_url")
    .eq("id", args.sceneId)
    .eq("venue_id", id)
    .maybeSingle();
  if (error) return textError(error.message);
  if (!release) {
    if (!scene || !scene.enabled || scene.kind !== "media") return textError("That visual is not available.");
    if (scene.media_kind !== "image" && scene.media_kind !== "video") {
      return textError("Only image and video visuals can be preloaded.");
    }
    if (!scene.public_url) return textError("That visual has no file yet.");
  }
  const toolName = release ? "release_led_preload" : "pin_led_preload";
  return audited(deps, toolName, args, false, release ? "Preload released." : "Preload pinned.", async () => {
    if (release) {
      const { error: deleteError } = await deps.client
        .from("led_wall_preload_pins" as never)
        .delete()
        .eq("venue_id" as never, id as never)
        .eq("scene_id" as never, args.sceneId as never);
      if (deleteError) return textError(deleteError.message);
      return { ok: true, message: "The Local Runner will stop keeping that visual warm. The live wall is unchanged." };
    }
    const { error: upsertError } = await deps.client.from("led_wall_preload_pins" as never).upsert(
      { venue_id: id, scene_id: args.sceneId } as never,
      { onConflict: "venue_id,scene_id", ignoreDuplicates: true },
    );
    if (upsertError) return textError(upsertError.message);
    return { ok: true, message: "The Local Runner will download this without changing what is live." };
  });
}

async function startTriviaTool(
  args: { packId: string; confirm?: boolean; questionCount?: number; actor?: string },
  deps: McpDeps,
) {
  const packs = await listTriviaPacks(deps.client, venueId(deps));
  const pack = packs.packs.find((item) => item.id === args.packId);
  if (!pack) return textError("That trivia pack was not found for this venue.");
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: `Start trivia “${pack.title}” and put it on the wall.`,
      current: await currentSceneLabel(deps.client, venueId(deps)),
      next: "A live trivia session starts and the trivia scene becomes the wall output.",
    });
    return audited(deps, "start_trivia", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "start_trivia", args, false, "Trivia started.", async () => {
    const started = await startTriviaSession(deps.client, {
      venueId: venueId(deps),
      packId: args.packId,
      questionCount: args.questionCount ?? TRIVIA_DEFAULT_QUESTION_COUNT,
      lobbySeconds: TRIVIA_DEFAULT_LOBBY_SECONDS,
      questionSeconds: TRIVIA_DEFAULT_QUESTION_SECONDS,
      startedBy: null,
    });
    if (!started.ok) return textError(started.message);
    const scenes = await listLedWallScenes(deps.client, venueId(deps));
    const triviaScene = scenes.scenes.find((scene) => scene.enabled && scene.kind === "trivia");
    if (triviaScene) {
      await deps.client.from("led_wall_runtime").upsert(
        {
          venue_id: venueId(deps),
          active_scene_id: triviaScene.id,
          active_playlist_id: null,
          activation_source: "manual",
          auto_event_id: null,
          auto_artist_id: null,
        },
        { onConflict: "venue_id" },
      );
    }
    return { ok: true, message: `Trivia is live. Join code ${started.joinCode}.`, joinCode: started.joinCode };
  });
}

async function endTriviaTool(args: { confirm?: boolean; actor?: string }, deps: McpDeps) {
  if (requiresConfirm(args.confirm)) {
    const preview = liveChangePreview({
      summary: "End the live trivia session.",
      current: await currentSceneLabel(deps.client, venueId(deps)),
      next: "The trivia session ends. The wall scene is left as it is until someone changes it.",
    });
    return audited(deps, "end_trivia", args, true, preview.summary, async () => preview);
  }
  return audited(deps, "end_trivia", args, false, "Trivia ended.", async () => {
    const ended = await endTriviaSession(deps.client, venueId(deps));
    if (!ended.ok) return textError(ended.message);
    return { ok: true, message: ended.message };
  });
}

export const MCP_TOOLS = [
  {
    name: "list_events",
    description: "List FloBama events. Defaults to upcoming shows.",
    writes: false,
    inputSchema: {
      query: z.string().trim().max(80).optional(),
      window: z.enum(["upcoming", "past", "cancelled"]).optional(),
    },
    run: listEventsTool,
  },
  {
    name: "get_event",
    description: "Get one FloBama event, including its artists.",
    writes: false,
    inputSchema: { eventId: z.string().uuid() },
    run: getEventTool,
  },
  {
    name: "list_artists",
    description: "List active artists at FloBama.",
    writes: false,
    inputSchema: { query: z.string().trim().max(80).optional() },
    run: listArtistsTool,
  },
  {
    name: "list_wall_scenes",
    description: "List LED wall scenes the Local Runner can show.",
    writes: false,
    inputSchema: {},
    run: listWallScenesTool,
  },
  {
    name: "wall_status",
    description: "Read what is live on the wall, Local Runner heartbeat, and preload status.",
    writes: false,
    inputSchema: {},
    run: wallStatusTool,
  },
  {
    name: "today_schedule",
    description: "List today’s shows and the LED graphic each artist would use.",
    writes: false,
    inputSchema: {},
    run: todayScheduleTool,
  },
  {
    name: "trivia_status",
    description: "List trivia packs and the current trivia session, if one is running.",
    writes: false,
    inputSchema: {},
    run: triviaStatusTool,
  },
  {
    name: "list_menu_specials",
    description: "List menu specials that can appear on the vertical screens.",
    writes: false,
    inputSchema: {},
    run: listSpecialsTool,
  },
  {
    name: "list_led_playlists",
    description: "List LED wall playlists.",
    writes: false,
    inputSchema: {},
    run: listLedPlaylistsTool,
  },
  {
    name: "save_event",
    description: "Create or update one event. Pass eventId to update. Does not change the live wall.",
    writes: true,
    inputSchema: {
      eventId: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(200),
      eventType: z.enum(EVENT_TYPES),
      startDate: z.string(),
      startTime: z.string(),
      endDate: z.string(),
      endTime: z.string(),
      status: z.enum(["draft", "published", "cancelled"]),
      visibility: z.enum(["public", "private"]),
      featured: z.boolean().optional(),
      isTicketed: z.boolean().optional(),
      locationLabel: z.string().max(160).optional(),
      publicDescription: z.string().max(8000).optional(),
      internalNotes: z.string().max(8000).optional(),
      ticketUrl: z.string().max(500).optional(),
      coverLabel: z.string().max(40).optional(),
      artistIds: z.array(z.string().uuid()).optional(),
      actor: actorField,
    },
    run: saveEventTool,
  },
  {
    name: "set_event_status",
    description: "Set one event to draft, published, or cancelled.",
    writes: true,
    inputSchema: {
      eventId: z.string().uuid(),
      status: z.enum(["draft", "published", "cancelled"]),
      actor: actorField,
    },
    run: setEventStatusTool,
  },
  {
    name: "archive_event",
    description: "Archive one event. Returns a preview until confirm is true.",
    writes: true,
    destructive: true,
    inputSchema: { eventId: z.string().uuid(), confirm: confirmField, actor: actorField },
    run: archiveEventTool,
  },
  {
    name: "save_artist",
    description: "Create or update one artist. Pass artistId to update.",
    writes: true,
    inputSchema: {
      artistId: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(160),
      genre: z.string().max(80).optional(),
      bio: z.string().max(4000).optional(),
      websiteUrl: z.string().max(500).optional(),
      actor: actorField,
    },
    run: saveArtistTool,
  },
  {
    name: "archive_artist",
    description: "Archive one artist. Returns a preview until confirm is true.",
    writes: true,
    destructive: true,
    inputSchema: { artistId: z.string().uuid(), confirm: confirmField, actor: actorField },
    run: archiveArtistTool,
  },
  {
    name: "put_scene_on_wall",
    description: "Make one LED scene live. Returns a preview until confirm is true. Does not change the wall on preview.",
    writes: true,
    destructive: true,
    inputSchema: { sceneId: z.string().uuid(), confirm: confirmField, actor: actorField },
    run: putSceneOnWall,
  },
  {
    name: "put_artist_on_wall",
    description: "Put an artist’s default LED graphic live. Returns a preview until confirm is true.",
    writes: true,
    destructive: true,
    inputSchema: {
      artistId: z.string().uuid(),
      sceneId: z.string().uuid().optional(),
      eventId: z.string().uuid().optional(),
      confirm: confirmField,
      actor: actorField,
    },
    run: putArtistOnWall,
  },
  {
    name: "activate_led_playlist",
    description: "Start an LED playlist on the wall. Returns a preview until confirm is true.",
    writes: true,
    destructive: true,
    inputSchema: { playlistId: z.string().uuid(), confirm: confirmField, actor: actorField },
    run: activatePlaylist,
  },
  {
    name: "pin_led_preload",
    description: "Ask the Local Runner to download a visual ahead of time. Does not change what is live.",
    writes: true,
    inputSchema: { sceneId: z.string().uuid(), actor: actorField },
    run: (args: { sceneId: string; actor?: string }, deps: McpDeps) => pinPreload(args, deps, false),
  },
  {
    name: "release_led_preload",
    description: "Stop asking the Local Runner to keep a visual warm. Does not change what is live.",
    writes: true,
    inputSchema: { sceneId: z.string().uuid(), actor: actorField },
    run: (args: { sceneId: string; actor?: string }, deps: McpDeps) => pinPreload(args, deps, true),
  },
  {
    name: "start_trivia",
    description: "Start a trivia pack and put trivia on the wall. Returns a preview until confirm is true.",
    writes: true,
    destructive: true,
    inputSchema: {
      packId: z.string().uuid(),
      questionCount: z.number().int().min(1).max(50).optional(),
      confirm: confirmField,
      actor: actorField,
    },
    run: startTriviaTool,
  },
  {
    name: "end_trivia",
    description: "End the live trivia session. Returns a preview until confirm is true.",
    writes: true,
    destructive: true,
    inputSchema: { confirm: confirmField, actor: actorField },
    run: endTriviaTool,
  },
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number]["name"];

export async function runMcpTool(name: string, args: Record<string, unknown>, deps: McpDeps): Promise<ToolResult> {
  const tool = MCP_TOOLS.find((item) => item.name === name);
  if (!tool) return textError("Unknown tool.");
  return tool.run(args as never, deps);
}
