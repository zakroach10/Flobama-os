import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE, type EventType } from "@/lib/constants";
import { parseVenueLocalDateTime } from "@/lib/timezone";

export type LegacySkipReason =
  | "unpublished"
  | "archived"
  | "test_event"
  | "missing_id"
  | "invalid_date"
  | "invalid_time";

export type LegacySkippedRow = {
  title: string;
  legacySourceId: string | null;
  reason: LegacySkipReason;
};

export type ParsedLegacyEvent = {
  legacySourceId: string;
  title: string;
  eventType: EventType;
  startsAtIso: string;
  endsAtIso: string;
  isTicketed: boolean;
  ticketUrl: string | null;
  coverLabel: string | null;
  internalNotes: string | null;
  artistName: string | null;
};

export type LegacyWithdrawnRow = {
  title: string;
  legacySourceId: string;
  archived: boolean;
};

export type LegacyParseResult = {
  importable: ParsedLegacyEvent[];
  withdrawn: LegacyWithdrawnRow[];
  skipped: LegacySkippedRow[];
};

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  day: "day",
  date: "date",
  time: "time",
  ticketed: "ticketed",
  "ticket link": "ticketLink",
  "cover charge": "coverCharge",
  "event id": "eventId",
  published: "published",
  archived: "archived",
  "internal notes": "internalNotes",
};

export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => HEADER_ALIASES[header.trim().toLowerCase()] ?? header.trim());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

export function isYes(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "yes";
}

export function inferEventType(title: string): EventType {
  const normalized = title.trim();
  if (/karaoke\s*\/\s*dj/i.test(normalized)) return "dj";
  if (/\bkaraoke\b/i.test(normalized)) return "karaoke";
  if (/\b(game|lsu|alabama)\b/i.test(normalized)) return "sports";
  return "live_music";
}

export function artistNameFromTitle(title: string): string | null {
  const type = inferEventType(title);
  if (type === "karaoke" || type === "dj") return null;

  let name = title.trim();
  name = name.replace(/\s*\(Ticketed Show\)\s*$/i, "");
  name = name.replace(/\s*\((?:[^)]*\b(?:LSU|Alabama|game)[^)]*)\)\s*$/i, "");
  name = name.replace(/\s+for Dinner\s*$/i, "");
  name = name.replace(/\s+Late Night\s*$/i, "");
  name = name.trim();

  if (!name || /^tba$/i.test(name) || /^karaoke$/i.test(name)) return null;
  return name;
}

export function parseSheetDate(raw: string): string | null {
  const value = raw.trim();
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!us) return null;
  const month = us[1].padStart(2, "0");
  const day = us[2].padStart(2, "0");
  let year = Number(us[3]);
  if (us[3].length === 2) {
    year = year < 70 ? 2000 + year : 1900 + year;
  }
  return `${year}-${month}-${day}`;
}

export function parseSheetTime(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const excel = value.match(/^1899-12-30(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (excel) {
    return `${excel[1].padStart(2, "0")}:${excel[2]}`;
  }

  const withMeridiem = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/);
  if (withMeridiem) {
    let hour = Number(withMeridiem[1]);
    const minute = withMeridiem[2];
    const meridiem = withMeridiem[3].toLowerCase();
    if (meridiem === "am") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const twentyFour = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFour) {
    let hour = Number(twentyFour[1]);
    const minute = twentyFour[2];
    if (hour < 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  return null;
}

export function defaultEndClock(startDate: string, startTime: string, timeZone = DEFAULT_VENUE_TIMEZONE) {
  const [hour] = startTime.split(":").map(Number);
  if (hour >= 21) {
    const next = DateTime.fromISO(`${startDate}T${startTime}`, { zone: timeZone }).plus({ days: 1 });
    return { endDate: next.toFormat("yyyy-LL-dd"), endTime: "01:00" };
  }
  const start = DateTime.fromISO(`${startDate}T${startTime}`, { zone: timeZone }).plus({ hours: 3 });
  return { endDate: start.toFormat("yyyy-LL-dd"), endTime: start.toFormat("HH:mm") };
}

export function normalizeTicketUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /^n\/?a$/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function normalizeCoverLabel(raw: string): string | null {
  const value = raw.trim();
  return value ? value : null;
}

export function parseLegacySheet(text: string, timeZone = DEFAULT_VENUE_TIMEZONE): LegacyParseResult {
  const importable: ParsedLegacyEvent[] = [];
  const withdrawn: LegacyWithdrawnRow[] = [];
  const skipped: LegacySkippedRow[] = [];

  for (const record of parseCsvRecords(text)) {
    const title = (record.name ?? "").trim();
    const legacySourceId = (record.eventId ?? "").trim() || null;

    if (/^test event$/i.test(title)) {
      skipped.push({ title, legacySourceId, reason: "test_event" });
      continue;
    }
    if (isYes(record.archived)) {
      skipped.push({ title, legacySourceId, reason: "archived" });
      if (legacySourceId) withdrawn.push({ title, legacySourceId, archived: true });
      continue;
    }
    if (!isYes(record.published)) {
      skipped.push({ title, legacySourceId, reason: "unpublished" });
      if (legacySourceId) withdrawn.push({ title, legacySourceId, archived: false });
      continue;
    }
    if (!legacySourceId) {
      skipped.push({ title, legacySourceId, reason: "missing_id" });
      continue;
    }

    const date = parseSheetDate(record.date ?? "");
    if (!date) {
      skipped.push({ title, legacySourceId, reason: "invalid_date" });
      continue;
    }
    const time = parseSheetTime(record.time ?? "");
    if (!time) {
      skipped.push({ title, legacySourceId, reason: "invalid_time" });
      continue;
    }

    const start = parseVenueLocalDateTime(date, time, timeZone);
    if (!start.ok) {
      skipped.push({ title, legacySourceId, reason: "invalid_time" });
      continue;
    }
    const endClock = defaultEndClock(date, time, timeZone);
    const end = parseVenueLocalDateTime(endClock.endDate, endClock.endTime, timeZone);
    if (!end.ok) {
      skipped.push({ title, legacySourceId, reason: "invalid_time" });
      continue;
    }

    importable.push({
      legacySourceId,
      title,
      eventType: inferEventType(title),
      startsAtIso: start.iso,
      endsAtIso: end.iso,
      isTicketed: isYes(record.ticketed),
      ticketUrl: normalizeTicketUrl(record.ticketLink ?? ""),
      coverLabel: normalizeCoverLabel(record.coverCharge ?? ""),
      internalNotes: (record.internalNotes ?? "").trim() || null,
      artistName: artistNameFromTitle(title),
    });
  }

  return { importable, withdrawn, skipped };
}
