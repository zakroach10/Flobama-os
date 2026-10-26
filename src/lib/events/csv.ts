import {
  defaultEndClock,
  inferEventType,
  parseCsvRecords,
  parseSheetDate,
  normalizeCoverLabel,
  normalizeTicketUrl,
} from "@/lib/legacy/parser";
import { EVENT_STATUSES, EVENT_TYPES, EVENT_VISIBILITIES, type EventStatus, type EventType, type EventVisibility } from "@/lib/constants";
import { parseVenueLocalDateTime } from "@/lib/timezone";

export type ParsedEventCsvRow = {
  title: string;
  eventType: EventType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  startsAtIso: string;
  endsAtIso: string;
  locationLabel: string | null;
  publicDescription: string | null;
  internalNotes: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  isTicketed: boolean;
  ticketUrl: string | null;
  coverLabel: string | null;
  artistNames: string[];
  line: number;
};

export type EventCsvParseResult = {
  events: ParsedEventCsvRow[];
  errors: string[];
};

const HEADER_MAP: Record<string, string> = {
  title: "title",
  name: "title",
  event: "title",
  event_type: "eventType",
  "event type": "eventType",
  type: "eventType",
  start_date: "startDate",
  "start date": "startDate",
  date: "startDate",
  start_time: "startTime",
  "start time": "startTime",
  time: "startTime",
  end_date: "endDate",
  "end date": "endDate",
  end_time: "endTime",
  "end time": "endTime",
  location: "locationLabel",
  location_label: "locationLabel",
  "location label": "locationLabel",
  stage: "locationLabel",
  public_description: "publicDescription",
  "public description": "publicDescription",
  description: "publicDescription",
  internal_notes: "internalNotes",
  "internal notes": "internalNotes",
  internalnotes: "internalNotes",
  notes: "internalNotes",
  status: "status",
  visibility: "visibility",
  featured: "featured",
  is_ticketed: "isTicketed",
  ticketed: "isTicketed",
  "is ticketed": "isTicketed",
  ticket_url: "ticketUrl",
  "ticket url": "ticketUrl",
  "ticket link": "ticketUrl",
  ticketlink: "ticketUrl",
  cover_label: "coverLabel",
  "cover label": "coverLabel",
  cover: "coverLabel",
  "cover charge": "coverLabel",
  covercharge: "coverLabel",
  artists: "artists",
  artist: "artists",
  artist_names: "artists",
  "artist names": "artists",
};

const TYPE_ALIASES: Record<string, EventType> = {
  live_music: "live_music",
  "live music": "live_music",
  live: "live_music",
  music: "live_music",
  karaoke: "karaoke",
  dj: "dj",
  sports: "sports",
  sport: "sports",
  private_event: "private_event",
  "private event": "private_event",
  private: "private_event",
  other: "other",
};

function normalizeHeader(raw: string) {
  return HEADER_MAP[raw.trim().toLowerCase()] ?? raw.trim();
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed) return fallback;
  if (["yes", "y", "true", "1", "x"].includes(trimmed)) return true;
  if (["no", "n", "false", "0"].includes(trimmed)) return false;
  return null;
}

function parseEventType(raw: string, title: string): EventType | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return inferEventType(title);
  return TYPE_ALIASES[trimmed] ?? null;
}

function parseStatus(raw: string): EventStatus | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "draft";
  if ((EVENT_STATUSES as readonly string[]).includes(trimmed)) return trimmed as EventStatus;
  return null;
}

function parseVisibility(raw: string): EventVisibility | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "public";
  if ((EVENT_VISIBILITIES as readonly string[]).includes(trimmed)) return trimmed as EventVisibility;
  return null;
}

/** 24-hour HH:MM, or 12-hour with AM/PM. Bare times are not shifted to PM. */
export function parseEventCsvTime(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const withMeridiem = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/);
  if (withMeridiem) {
    let hour = Number(withMeridiem[1]);
    const minute = withMeridiem[2];
    const meridiem = withMeridiem[3].toLowerCase();
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "am") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const twentyFour = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = twentyFour[2];
    if (hour > 23) return null;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  return null;
}

function parseArtistNames(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  return value
    .split(/[|;]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parseEventCsv(text: string, timeZone: string): EventCsvParseResult {
  const rawRows = parseCsvRecords(text);
  if (rawRows.length === 0) {
    return { events: [], errors: ["Spreadsheet is empty."] };
  }

  const events: ParsedEventCsvRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((raw, index) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      row[normalizeHeader(key)] = value;
    }

    const title = (row.title ?? "").trim();
    const line = index + 2;
    const hasAny =
      title ||
      (row.startDate ?? "").trim() ||
      (row.startTime ?? "").trim() ||
      (row.artists ?? "").trim();
    if (!hasAny) return;

    if (!title || title.length > 200) {
      errors.push(`Row ${line}: title is required (max 200 characters).`);
      return;
    }

    const startDate = parseSheetDate(row.startDate ?? "");
    if (!startDate) {
      errors.push(`Row ${line}: start_date must be YYYY-MM-DD or M/D/YY.`);
      return;
    }

    const startTime = parseEventCsvTime(row.startTime ?? "");
    if (!startTime) {
      errors.push(`Row ${line}: start_time must be HH:MM (24-hour) or h:mm AM/PM.`);
      return;
    }

    let endDate = (row.endDate ?? "").trim() ? parseSheetDate(row.endDate) : null;
    let endTime = (row.endTime ?? "").trim() ? parseEventCsvTime(row.endTime) : null;
    if ((row.endDate ?? "").trim() && !endDate) {
      errors.push(`Row ${line}: end_date must be YYYY-MM-DD or M/D/YY.`);
      return;
    }
    if ((row.endTime ?? "").trim() && !endTime) {
      errors.push(`Row ${line}: end_time must be HH:MM (24-hour) or h:mm AM/PM.`);
      return;
    }
    if (!endDate || !endTime) {
      const defaults = defaultEndClock(startDate, startTime, timeZone);
      endDate = endDate ?? defaults.endDate;
      endTime = endTime ?? defaults.endTime;
    }

    const start = parseVenueLocalDateTime(startDate, startTime, timeZone);
    const end = parseVenueLocalDateTime(endDate, endTime, timeZone);
    if (!start.ok) {
      errors.push(`Row ${line}: ${start.message}`);
      return;
    }
    if (!end.ok) {
      errors.push(`Row ${line}: ${end.message}`);
      return;
    }
    if (end.dateTime <= start.dateTime) {
      errors.push(`Row ${line}: end must be after start. Overnight events should use the next calendar date.`);
      return;
    }

    const eventType = parseEventType(row.eventType ?? "", title);
    if (!eventType) {
      errors.push(
        `Row ${line}: event_type must be one of ${EVENT_TYPES.join(", ")}.`,
      );
      return;
    }

    const status = parseStatus(row.status ?? "");
    if (!status) {
      errors.push(`Row ${line}: status must be draft, published, or cancelled.`);
      return;
    }

    const visibility = parseVisibility(row.visibility ?? "");
    if (!visibility) {
      errors.push(`Row ${line}: visibility must be public or private.`);
      return;
    }

    const featured = parseBoolean(row.featured, false);
    if (featured == null) {
      errors.push(`Row ${line}: featured must be yes/no.`);
      return;
    }

    const isTicketed = parseBoolean(row.isTicketed, false);
    if (isTicketed == null) {
      errors.push(`Row ${line}: is_ticketed must be yes/no.`);
      return;
    }

    const ticketUrl = normalizeTicketUrl(row.ticketUrl ?? "");
    if (ticketUrl && !/^https?:\/\//i.test(ticketUrl)) {
      errors.push(`Row ${line}: ticket_url must start with http:// or https://.`);
      return;
    }

    events.push({
      title,
      eventType,
      startDate,
      startTime,
      endDate,
      endTime,
      startsAtIso: start.iso,
      endsAtIso: end.iso,
      locationLabel: (row.locationLabel ?? "").trim() || null,
      publicDescription: (row.publicDescription ?? "").trim() || null,
      internalNotes: (row.internalNotes ?? "").trim() || null,
      status,
      visibility,
      featured,
      isTicketed,
      ticketUrl,
      coverLabel: normalizeCoverLabel(row.coverLabel ?? ""),
      artistNames: parseArtistNames(row.artists ?? ""),
      line,
    });
  });

  if (events.length === 0 && errors.length === 0) {
    errors.push(
      "No event rows found. Use headers: title,event_type,start_date,start_time,end_date,end_time,location,status,visibility,artists",
    );
  }

  return { events, errors };
}

export const EVENTS_CSV_SAMPLE = `title,event_type,start_date,start_time,end_date,end_time,location,public_description,internal_notes,status,visibility,featured,is_ticketed,ticket_url,cover_label,artists
Friday Live Music,live_music,2026-11-07,18:30,2026-11-07,22:00,Main room,Live band night on the main stage.,Sound check 5:30 PM,draft,public,no,no,,$5,The Swampers
Karaoke Night,karaoke,2026-11-08,19:00,2026-11-09,01:00,Main room,House karaoke. Bring your best voice.,,draft,public,no,no,,,
Ticketed Showcase,live_music,2026-11-14,20:00,2026-11-14,23:00,Main room,Advance tickets recommended.,Hold doors until 7:45,draft,public,yes,yes,https://example.com/tickets,$10,Band One; Band Two
`;

export const EVENTS_CSV_SAMPLE_FILENAME = "flobama-events-sample.csv";
