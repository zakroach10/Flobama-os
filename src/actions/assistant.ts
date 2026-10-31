"use server";

import { z } from "zod";
import { saveArtistAction, saveEventAction, type ActionResult } from "@/actions/records";
import { activateDefaultAdRollAction } from "@/actions/artist-led";
import { activateLedWallSceneAction } from "@/actions/led-wall";
import { activateLedPlaylistAction } from "@/actions/led-playlists";
import { playYoutubeOnWallAction } from "@/actions/server-station";
import { getStaffContext } from "@/lib/auth/staff";
import { showStaffAssistant } from "@/lib/assistant/access";
import { completeAssistantPlan } from "@/lib/assistant/openai";
import {
  eventRecordToFormInput,
  fillEventWindow,
  latestUserText,
  listingResultMessage,
  matchAssistantEvent,
  matchCatalogItem,
  normalizeTicketUrl,
  normalizeWebsite,
  prepareAssistantPlan,
  sanitizeConversation,
  type AssistantCatalog,
  type AssistantEventRecord,
  type AssistantPlan,
} from "@/lib/assistant/plan";
import { authorizeLedWallActivate, canManageProgramming } from "@/lib/auth/permissions";
import { artistNameMatches } from "@/lib/queries/artists";
import { artistNames, getEventById, searchEvents } from "@/lib/queries/events";
import { listStaffLedPlaylists } from "@/lib/queries/led-playlists";
import { getLedWallRuntime, listLedWallScenes } from "@/lib/queries/led-wall";
import { getOpenAiConfig } from "@/lib/env";
import { formatVenueDateTime } from "@/lib/timezone";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseYoutubeVideoUrl } from "@/lib/screens/youtube";

export type AssistantActionResult = {
  ok: boolean;
  reply: string;
  href?: string;
  hrefLabel?: string;
  changed?: boolean;
};

const requestSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).max(20),
});

function failureText(result: ActionResult): string {
  const detail = result.fieldErrors
    ? Object.values(result.fieldErrors)
        .flat()
        .find((message) => message.trim())
    : null;
  return detail ? `${result.message} ${detail}` : result.message;
}

async function loadCatalog(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  venueId: string,
  timeZone: string,
  permissions: { canProgram: boolean; canChangeWall: boolean; canPlayYoutube: boolean },
): Promise<AssistantCatalog> {
  const now = new Date().toISOString();
  const [artistRes, eventRes, sceneRes, playlistRes, runtimeRes] = await Promise.all([
    supabase
      .from("artists")
      .select("id, name")
      .eq("venue_id", venueId)
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(300),
    searchEvents(
      supabase,
      venueId,
      {
        window: "upcoming",
        query: "",
        status: "all",
        eventType: "all",
        fromDate: null,
        toDate: null,
        page: 1,
        pageSize: 40,
        timeZone,
      },
      now,
    ),
    listLedWallScenes(supabase, venueId),
    listStaffLedPlaylists(supabase, venueId),
    getLedWallRuntime(supabase, venueId),
  ]);

  const notes: string[] = [];
  if (artistRes.error) notes.push("Artist directory could not be loaded.");
  if (eventRes.error) notes.push("Upcoming events could not be loaded.");
  if (sceneRes.error) notes.push("LED scenes could not be loaded.");
  if (playlistRes.error) notes.push("LED playlists could not be loaded.");

  const scenes = (sceneRes.scenes ?? [])
    .filter((scene) => scene.enabled)
    .slice(0, 80)
    .map((scene) => ({ id: scene.id, name: scene.title }));
  const playlists = playlistRes.playlists.slice(0, 30).map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
  }));
  const activeScene = scenes.find((scene) => scene.id === runtimeRes.runtime?.active_scene_id)?.name ?? null;
  const activePlaylist =
    playlists.find((playlist) => playlist.id === runtimeRes.runtime?.active_playlist_id)?.name ?? null;

  return {
    timeZone,
    nowLabel: formatVenueDateTime(now, timeZone, "cccc, LLL d, yyyy • h:mm a"),
    ...permissions,
    wall: { scene: activeScene, playlist: activePlaylist },
    scenes,
    playlists,
    artists: (artistRes.data ?? []).map((artist) => ({ id: artist.id, name: artist.name })),
    events: eventRes.events.map((event) => ({
      id: event.id,
      name: event.title,
      title: event.title,
      when: formatVenueDateTime(event.starts_at, timeZone, "ccc, LLL d, h:mm a"),
      status: event.status,
      visibility: event.visibility,
      artists: artistNames(event),
    })),
    notes,
  };
}

async function resolveArtistIds(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  venueId: string,
  catalog: AssistantCatalog,
  names: string[],
  createMissing: boolean,
): Promise<{ ok: true; ids: string[]; created: string[] } | { ok: false; message: string }> {
  const ids: string[] = [];
  const created: string[] = [];
  for (const name of names) {
    const known = matchCatalogItem(catalog.artists, name, "artist");
    if (known.ok) {
      ids.push(known.item.id);
      continue;
    }
    if (known.message.startsWith("Several")) return { ok: false, message: known.message };
    if (!createMissing) {
      return {
        ok: false,
        message: `${known.message} Say add artist ${name.trim()} and I will create them.`,
      };
    }
    const duplicates = await artistNameMatches(supabase, venueId, name);
    if (duplicates.error) return { ok: false, message: duplicates.error };
    if (duplicates.matches.length === 1) {
      ids.push(duplicates.matches[0].id);
      continue;
    }
    if (duplicates.matches.length > 1) {
      return {
        ok: false,
        message: `Several artists match “${name.trim()}”: ${duplicates.matches
          .map((artist) => artist.name)
          .join(", ")}.`,
      };
    }
    const saved = await saveArtistAction({ name: name.trim(), genre: "", bio: "", websiteUrl: "" });
    if (!saved.ok || !saved.id) return { ok: false, message: failureText(saved) };
    ids.push(saved.id);
    created.push(name.trim());
    catalog.artists.push({ id: saved.id, name: name.trim() });
  }
  return { ok: true, ids, created };
}

async function executePlan(
  plan: AssistantPlan,
  catalog: AssistantCatalog,
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  venueId: string,
): Promise<AssistantActionResult> {
  if (
    (plan.action === "create_artist" || plan.action === "create_event" || plan.action === "update_listing") &&
    !catalog.canProgram
  ) {
    return {
      ok: false,
      reply: "This login can change the LED wall. Adding artists, events, and the public website needs an admin or manager.",
    };
  }
  if (
    (plan.action === "show_scene" || plan.action === "show_playlist" || plan.action === "resume_house_ads") &&
    !catalog.canChangeWall
  ) {
    return { ok: false, reply: "This login cannot change the LED wall." };
  }
  if (plan.action === "play_youtube" && !catalog.canPlayYoutube) {
    return { ok: false, reply: "Playing YouTube on the wall needs an admin or manager login." };
  }

  if (plan.action === "none") {
    return { ok: true, reply: plan.reply, changed: false };
  }

  if (plan.action === "create_artist") {
    if (!plan.artist) return { ok: false, reply: "Tell me the artist name to add." };
    const existing = matchCatalogItem(catalog.artists, plan.artist.name, "artist");
    if (existing.ok) {
      return {
        ok: true,
        reply: `${existing.item.name} is already in the artist directory.`,
        href: `/artists/${existing.item.id}`,
        hrefLabel: "Open artist",
        changed: false,
      };
    }
    if (existing.message.startsWith("Several")) return { ok: false, reply: existing.message };
    const duplicates = await artistNameMatches(supabase, venueId, plan.artist.name);
    if (duplicates.error) return { ok: false, reply: duplicates.error };
    if (duplicates.matches.length === 1) {
      return {
        ok: true,
        reply: `${duplicates.matches[0].name} is already in the artist directory.`,
        href: `/artists/${duplicates.matches[0].id}`,
        hrefLabel: "Open artist",
        changed: false,
      };
    }
    const website = normalizeWebsite(plan.artist.websiteUrl);
    const saved = await saveArtistAction({
      name: plan.artist.name,
      genre: plan.artist.genre ?? "",
      bio: plan.artist.bio ?? "",
      websiteUrl: website,
    });
    if (!saved.ok || !saved.id) return { ok: false, reply: failureText(saved) };
    const websiteNote = plan.artist.websiteUrl && !website ? " I left the website off because it was not a link." : "";
    return {
      ok: true,
      reply: `${saved.message}${websiteNote}`,
      href: `/artists/${saved.id}`,
      hrefLabel: "Open artist",
      changed: true,
    };
  }

  if (plan.action === "create_event") {
    if (!plan.event) return { ok: false, reply: "Tell me the show name, date, and start time." };
    const window = fillEventWindow(
      plan.event.startDate,
      plan.event.startTime,
      plan.event.endDate,
      plan.event.endTime,
      catalog.timeZone,
    );
    if ("error" in window) return { ok: false, reply: window.error };
    const artists = await resolveArtistIds(
      supabase,
      venueId,
      catalog,
      plan.event.artistNames,
      plan.event.createMissingArtists,
    );
    if (!artists.ok) return { ok: false, reply: artists.message };
    const ticketUrl = normalizeTicketUrl(plan.event.ticketUrl);
    const saved = await saveEventAction({
      title: plan.event.title,
      eventType: plan.event.eventType,
      startDate: window.startDate,
      startTime: window.startTime,
      endDate: window.endDate,
      endTime: window.endTime,
      locationLabel: plan.event.locationLabel ?? "",
      publicDescription: plan.event.publicDescription ?? "",
      internalNotes: "",
      status: plan.event.status,
      visibility: plan.event.visibility,
      featured: plan.event.featured,
      isTicketed: Boolean(ticketUrl),
      ticketUrl,
      coverLabel: plan.event.coverLabel ?? "",
      artistIds: artists.ids,
      timeZone: catalog.timeZone,
    });
    if (!saved.ok || !saved.id) return { ok: false, reply: failureText(saved) };
    const createdNote = artists.created.length ? ` Added ${artists.created.join(", ")} to the artist directory.` : "";
    const listing = listingResultMessage(plan.event.status, plan.event.visibility);
    return {
      ok: true,
      reply: `${plan.event.title} is on the schedule. ${listing}${createdNote}`,
      href: `/programming/${saved.id}`,
      hrefLabel: "Open event",
      changed: true,
    };
  }

  if (plan.action === "update_listing") {
    if (!plan.listing) return { ok: false, reply: "Tell me which event to publish, hide, or cancel." };
    const matched = matchAssistantEvent(catalog.events, plan.listing.title, plan.listing.when);
    if (!matched.ok) return { ok: false, reply: matched.message };
    const loaded = await getEventById(supabase, matched.event.id);
    if (loaded.error || !loaded.event || loaded.event.venue_id !== venueId) {
      return { ok: false, reply: loaded.error ?? "That event is not on this venue's schedule." };
    }
    const record: AssistantEventRecord = {
      title: loaded.event.title,
      event_type: loaded.event.event_type,
      starts_at: loaded.event.starts_at,
      ends_at: loaded.event.ends_at,
      location_label: loaded.event.location_label,
      public_description: loaded.event.public_description,
      internal_notes: loaded.event.internal_notes,
      status: loaded.event.status,
      visibility: loaded.event.visibility,
      featured: loaded.event.featured,
      is_ticketed: loaded.event.is_ticketed,
      ticket_url: loaded.event.ticket_url,
      cover_label: loaded.event.cover_label,
      artistIds: loaded.event.event_artists.map((row) => row.artist_id),
    };
    const nextStatus = plan.listing.status ?? record.status;
    const nextVisibility = plan.listing.visibility ?? record.visibility;
    const saved = await saveEventAction(
      eventRecordToFormInput(record, catalog.timeZone, {
        status: nextStatus,
        visibility: nextVisibility,
      }),
      loaded.event.id,
    );
    if (!saved.ok) return { ok: false, reply: failureText(saved) };
    return {
      ok: true,
      reply: `${loaded.event.title}: ${listingResultMessage(nextStatus, nextVisibility)}`,
      href: `/programming/${loaded.event.id}`,
      hrefLabel: "Open event",
      changed: true,
    };
  }

  if (plan.action === "show_scene") {
    if (!plan.wallName) return { ok: false, reply: "Tell me which LED scene to put on the wall." };
    const scene = matchCatalogItem(catalog.scenes, plan.wallName, "scene");
    if (!scene.ok) return { ok: false, reply: scene.message };
    const result = await activateLedWallSceneAction({ sceneId: scene.item.id });
    return { ok: result.ok, reply: result.message, changed: result.ok };
  }

  if (plan.action === "show_playlist") {
    if (!plan.wallName) return { ok: false, reply: "Tell me which playlist to put on the wall." };
    const playlist = matchCatalogItem(catalog.playlists, plan.wallName, "playlist");
    if (!playlist.ok) return { ok: false, reply: playlist.message };
    const result = await activateLedPlaylistAction({ playlistId: playlist.item.id });
    return { ok: result.ok, reply: result.message, changed: result.ok };
  }

  if (plan.action === "resume_house_ads") {
    const result = await activateDefaultAdRollAction();
    return { ok: result.ok, reply: result.message, changed: result.ok };
  }

  if (plan.action === "play_youtube") {
    if (!plan.youtubeUrl || !parseYoutubeVideoUrl(plan.youtubeUrl)) {
      return { ok: false, reply: "Paste a YouTube video link to play it on the wall." };
    }
    const result = await playYoutubeOnWallAction({ url: plan.youtubeUrl });
    return { ok: result.ok, reply: result.message, changed: result.ok };
  }

  return { ok: true, reply: plan.reply, changed: false };
}

export async function askStaffAssistantAction(input: unknown): Promise<AssistantActionResult> {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false, reply: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false, reply: "Sign in required." };
  if (context.status === "denied") return { ok: false, reply: "You do not have staff access." };
  if (context.status === "error") return { ok: false, reply: context.message };
  if (!showStaffAssistant(context.menus, context.role)) {
    return { ok: false, reply: "The assistant is not available on this console." };
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reply: "Send a short message." };
  const turns = sanitizeConversation(parsed.data.messages);
  const userText = latestUserText(turns);
  if (!userText) return { ok: false, reply: "Send a message to the assistant." };

  const openAi = getOpenAiConfig();
  if (!openAi) {
    return {
      ok: false,
      reply: "The assistant is off until OPENAI_API_KEY is set on the server. Band-fit analysis uses the same key.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, reply: "Supabase is not configured." };

  const catalog = await loadCatalog(supabase, context.venue.id, context.venue.timezone, {
    canProgram: canManageProgramming(context.role),
    canChangeWall: authorizeLedWallActivate(context.role).allowed,
    canPlayYoutube: canManageProgramming(context.role),
  });

  const completed = await completeAssistantPlan(catalog, turns, { config: openAi });
  if (!completed.ok) return { ok: false, reply: completed.message };

  const plan = prepareAssistantPlan(completed.plan, userText);
  return executePlan(plan, catalog, supabase, context.venue.id);
}
