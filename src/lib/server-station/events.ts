import { DateTime } from "luxon";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { artistNames, type EventRow } from "@/lib/queries/events";
import { getPublicAppUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";

type Client = SupabaseClient<Database>;

export type ServerStationEventCard = {
  id: string;
  title: string;
  artists: string[];
  startsAt: string;
  endsAt: string;
  startLabel: string;
  endLabel: string | null;
  dayLabel: string;
  coverLabel: string | null;
  ticketUrl: string | null;
  publicDescription: string | null;
  publicLink: string;
  eventType: string;
};

const EVENT_SELECT = `
  *,
  event_artists (
    artist_id,
    display_order,
    artists ( id, name, archived_at )
  )
`;

function formatEventCard(event: EventRow, timeZone: string, origin: string): ServerStationEventCard {
  const start = DateTime.fromISO(event.starts_at, { zone: "utc" }).setZone(timeZone);
  const end = DateTime.fromISO(event.ends_at, { zone: "utc" }).setZone(timeZone);
  return {
    id: event.id,
    title: event.title,
    artists: artistNames(event),
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    startLabel: start.isValid ? start.toFormat("h:mm a") : "TBA",
    endLabel: end.isValid ? end.toFormat("h:mm a") : null,
    dayLabel: start.isValid ? start.toFormat("cccc, LLL d") : "Date TBA",
    coverLabel: event.cover_label,
    ticketUrl: event.ticket_url,
    publicDescription: event.public_description,
    publicLink: joinPublicUrl(origin, `/tickets?event=${event.id}`),
    eventType: event.event_type,
  };
}

/** True when the event starts on the venue-local calendar day. */
export function isServerStationEventTonight(
  event: Pick<ServerStationEventCard, "startsAt">,
  timeZone = DEFAULT_VENUE_TIMEZONE,
  now = DateTime.now(),
) {
  const start = DateTime.fromISO(event.startsAt, { zone: "utc" }).setZone(timeZone);
  if (!start.isValid) return false;
  return start.hasSame(now.setZone(timeZone), "day");
}

/** Guest-facing band/act label for the header and rails. */
export function serverStationEventBandLabel(event: Pick<ServerStationEventCard, "title" | "artists">) {
  if (event.artists.length) return event.artists.join(", ");
  return event.title;
}

function rangeForBucket(bucket: "tonight" | "tomorrow" | "weekend" | "upcoming", timeZone: string, now = DateTime.now()) {
  const local = now.setZone(timeZone);
  if (bucket === "tonight") {
    const start = local.startOf("day");
    const end = local.endOf("day");
    return { start: start.toUTC().toISO()!, end: end.toUTC().toISO()! };
  }
  if (bucket === "tomorrow") {
    const day = local.plus({ days: 1 });
    return { start: day.startOf("day").toUTC().toISO()!, end: day.endOf("day").toUTC().toISO()! };
  }
  if (bucket === "weekend") {
    // Friday–Sunday of the current/local upcoming weekend window.
    const weekday = local.weekday; // 1=Mon … 7=Sun
    const friday = local.plus({ days: (5 - weekday + 7) % 7 }).startOf("day");
    const sunday = friday.plus({ days: 2 }).endOf("day");
    return { start: friday.toUTC().toISO()!, end: sunday.toUTC().toISO()! };
  }
  return {
    start: local.toUTC().toISO()!,
    end: local.plus({ days: 45 }).endOf("day").toUTC().toISO()!,
  };
}

export async function listServerStationEvents(
  client: Client,
  venueId: string,
  input: {
    bucket: "tonight" | "tomorrow" | "weekend" | "upcoming" | "search";
    query?: string;
    timeZone?: string;
  },
) {
  const timeZone = input.timeZone || DEFAULT_VENUE_TIMEZONE;
  const origin = getPublicAppUrl();
  let query = client
    .from("events")
    .select(EVENT_SELECT)
    .eq("venue_id", venueId)
    .eq("status", "published")
    .eq("visibility", "public")
    .is("archived_at", null)
    .order("starts_at", { ascending: true })
    .limit(40);

  if (input.bucket === "search" && input.query?.trim()) {
    const q = input.query.trim();
    query = query.or(`title.ilike.%${q}%,public_description.ilike.%${q}%`);
  } else if (input.bucket !== "search") {
    const range = rangeForBucket(input.bucket, timeZone);
    query = query.gte("starts_at", range.start).lte("starts_at", range.end);
  } else {
    const range = rangeForBucket("upcoming", timeZone);
    query = query.gte("starts_at", range.start).lte("starts_at", range.end);
  }

  const { data, error } = await query;
  if (error) return { events: [] as ServerStationEventCard[], error: error.message };

  let events = ((data ?? []) as unknown as EventRow[]).map((event) => formatEventCard(event, timeZone, origin));

  if (input.bucket === "search" && input.query?.trim()) {
    const needle = input.query.trim().toLowerCase();
    events = events.filter(
      (event) =>
        event.title.toLowerCase().includes(needle) ||
        event.artists.some((name) => name.toLowerCase().includes(needle)) ||
        (event.publicDescription ?? "").toLowerCase().includes(needle),
    );
  }

  return { events, error: null };
}
