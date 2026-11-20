import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE, EVENT_TYPE_LABELS, type EventType } from "@/lib/constants";
import { assertIanaZone } from "@/lib/timezone";

export type FacebookCopyField = {
  key: string;
  label: string;
  value: string;
};

export type FacebookCopyPack = {
  timeZone: string;
  postFields: FacebookCopyField[];
  eventFields: FacebookCopyField[];
  post: string;
  eventSetup: string;
};

/** Public event details only. Internal notes are not part of this input. */
export type FacebookCopyInput = {
  title?: string | null;
  publicDescription?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  timeZone?: string | null;
  locationLabel?: string | null;
  venueName?: string | null;
  hosts?: Array<string | null | undefined> | null;
  ticketUrl?: string | null;
  coverLabel?: string | null;
  isTicketed?: boolean | null;
  eventType?: string | null;
};

const EVENT_TYPE_KEYS = new Set<string>(Object.keys(EVENT_TYPE_LABELS));

export function resolveFacebookTimeZone(timeZone?: string | null): string {
  const trimmed = timeZone?.trim() ?? "";
  if (trimmed && assertIanaZone(trimmed)) return trimmed;
  return DEFAULT_VENUE_TIMEZONE;
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function momentFrom(
  iso: string | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined,
  zone: string,
): DateTime | null {
  const instant = clean(iso);
  if (instant) {
    const parsed = DateTime.fromISO(instant, { setZone: true }).setZone(zone);
    if (parsed.isValid) return parsed;
  }

  const day = clean(date);
  const clock = clean(time);
  if (!day || !clock) return null;
  const parsed = DateTime.fromISO(`${day}T${clock}`, { zone });
  if (!parsed.isValid) return null;
  if (parsed.toFormat("yyyy-LL-dd HH:mm") !== `${day} ${clock}`) return null;
  return parsed;
}

function formatClock(time: string | null | undefined): string {
  const clock = clean(time);
  const parsed = DateTime.fromFormat(clock, "HH:mm");
  if (!parsed.isValid) return "";
  return parsed.toFormat("h:mm a");
}

function formatDay(date: string | null | undefined, zone: string): string {
  const day = clean(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const parsed = DateTime.fromISO(day, { zone });
  if (!parsed.isValid) return "";
  return parsed.toFormat("cccc, LLLL d, yyyy");
}

function extractLinks(description: string, ticketUrl: string): string[] {
  const matches = description.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const ticket = ticketUrl.replace(/\/+$/, "");
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of matches) {
    const url = match.replace(/[),.;!?]+$/g, "");
    const key = url.replace(/\/+$/, "");
    if (!url || seen.has(key) || (ticket && key === ticket)) continue;
    seen.add(key);
    links.push(url);
  }
  return links;
}

function locationText(venueName: string, locationLabel: string): string {
  if (venueName && locationLabel) {
    if (venueName.toLowerCase() === locationLabel.toLowerCase()) return venueName;
    return `${venueName} · ${locationLabel}`;
  }
  return locationLabel || venueName;
}

function hostLine(hosts: FacebookCopyInput["hosts"]): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const host of hosts ?? []) {
    const name = host?.trim() ?? "";
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.join(", ");
}

function whenText(start: DateTime | null, end: DateTime | null): string {
  if (start && end) {
    const startAbbr = start.toFormat("ZZZZ");
    const endAbbr = end.toFormat("ZZZZ");
    if (start.hasSame(end, "day")) {
      const abbr = startAbbr === endAbbr ? startAbbr : `${startAbbr}–${endAbbr}`;
      return `${start.toFormat("cccc, LLLL d, yyyy")}, ${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")} ${abbr}`;
    }
    const abbr = startAbbr === endAbbr ? endAbbr : `${startAbbr}/${endAbbr}`;
    return `${start.toFormat("cccc, LLLL d, yyyy, h:mm a")} – ${end.toFormat("cccc, LLLL d, yyyy, h:mm a")} ${abbr}`;
  }
  const only = start ?? end;
  if (!only) return "";
  return `${only.toFormat("cccc, LLLL d, yyyy, h:mm a")} ${only.toFormat("ZZZZ")}`;
}

function field(key: string, label: string, value: string): FacebookCopyField | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return { key, label, value: trimmed };
}

function push(list: FacebookCopyField[], item: FacebookCopyField | null) {
  if (item) list.push(item);
}

function composePost(parts: {
  title: string;
  description: string;
  when: string;
  where: string;
  hosts: string;
  price: string;
  tickets: string;
  links: string[];
}): string {
  const blocks: string[] = [];
  if (parts.title) blocks.push(parts.title);
  if (parts.description) blocks.push(parts.description);
  const details = [
    parts.when ? `When: ${parts.when}` : "",
    parts.where ? `Where: ${parts.where}` : "",
    parts.hosts ? `Hosts: ${parts.hosts}` : "",
    parts.price ? `Price: ${parts.price}` : "",
    parts.tickets ? `Tickets: ${parts.tickets}` : "",
    parts.links.length ? `Links:\n${parts.links.join("\n")}` : "",
  ].filter(Boolean);
  if (details.length) blocks.push(details.join("\n"));
  return blocks.join("\n\n");
}

function composeEvent(fields: FacebookCopyField[]): string {
  return fields
    .map((item) =>
      item.key === "description" || item.key === "links" ? `${item.label}:\n${item.value}` : `${item.label}: ${item.value}`,
    )
    .join("\n");
}

export function buildFacebookCopy(input: FacebookCopyInput): FacebookCopyPack {
  const timeZone = resolveFacebookTimeZone(input.timeZone);
  const title = clean(input.title);
  const description = clean(input.publicDescription);
  const start = momentFrom(input.startsAt, input.startDate, input.startTime, timeZone);
  const end = momentFrom(input.endsAt, input.endDate, input.endTime, timeZone);
  const where = locationText(clean(input.venueName), clean(input.locationLabel));
  const hosts = hostLine(input.hosts);
  const ticketUrl = clean(input.ticketUrl);
  const price = clean(input.coverLabel);
  const tickets = ticketUrl || (input.isTicketed ? "Ticketed" : "");
  const links = extractLinks(description, ticketUrl);
  const eventType = clean(input.eventType);
  const category = EVENT_TYPE_KEYS.has(eventType) ? EVENT_TYPE_LABELS[eventType as EventType] : "";
  const startDateLabel = start ? start.toFormat("cccc, LLLL d, yyyy") : formatDay(input.startDate, timeZone);
  const endDateLabel = end ? end.toFormat("cccc, LLLL d, yyyy") : formatDay(input.endDate, timeZone);
  const startTimeLabel = start ? start.toFormat("h:mm a") : formatClock(input.startTime);
  const endTimeLabel = end ? end.toFormat("h:mm a") : formatClock(input.endTime);
  const when = whenText(start, end) || [startDateLabel, startTimeLabel].filter(Boolean).join(", ");
  const zoneLabel = start ? `${timeZone} (${start.toFormat("ZZZZ")})` : timeZone;

  const postFields: FacebookCopyField[] = [];
  push(postFields, field("title", "Title", title));
  push(postFields, field("when", "When", when));
  push(postFields, field("where", "Where", where));
  push(postFields, field("description", "Description", description));
  push(postFields, field("hosts", "Hosts", hosts));
  push(postFields, field("price", "Price", price));
  push(postFields, field("tickets", "Tickets", tickets));
  push(postFields, field("links", "Links", links.join("\n")));

  const eventFields: FacebookCopyField[] = [];
  push(eventFields, field("name", "Event name", title));
  push(eventFields, field("startDate", "Start date", startDateLabel));
  push(eventFields, field("startTime", "Start time", startTimeLabel));
  push(eventFields, field("endDate", "End date", endDateLabel));
  push(eventFields, field("endTime", "End time", endTimeLabel));
  push(eventFields, field("timezone", "Timezone", zoneLabel));
  push(eventFields, field("location", "Location", where));
  push(eventFields, field("description", "Description", description));
  push(eventFields, field("hosts", "Hosts", hosts));
  push(eventFields, field("category", "Category", category));
  push(eventFields, field("price", "Price", price));
  push(eventFields, field("tickets", "Tickets", tickets));
  push(eventFields, field("links", "Links", links.join("\n")));

  return {
    timeZone,
    postFields,
    eventFields,
    post: composePost({ title, description, when, where, hosts, price, tickets, links }),
    eventSetup: composeEvent(eventFields),
  };
}
