export interface ParsedEvent {
  id: string;
  name: string;
  day: string;
  dateStr: string;
  parsedDate: Date | null;
  time: string;
  ticketed: boolean;
  ticketLink: string;
  coverCharge: string;
  published: boolean;
  archived: boolean;
  publicValues: string[];
  details: { label: string; value: string }[];
  raw: string[];
}

export const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRENsjXeSHSUIuHU1Fne1ciKu6zW3FzaNxofXOvCUWjSKYaOHZskJupvfG3QHK-AeVfTvZwzN7VaMUk/pub?output=csv";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Formats any time string into a 12-hour AM/PM format (e.g., "8:00 PM", "7:30 PM - 10:30 PM").
 */
export function formatSingleTime12H(tStr: string): string {
  const trimmed = tStr.trim();
  if (!trimmed) return "";

  const ampmMatch = trimmed.match(/(am|pm)/i);
  const ampm = ampmMatch ? ampmMatch[1].toUpperCase() : null;

  const digitsMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!digitsMatch) return trimmed;

  let hours = parseInt(digitsMatch[1], 10);
  const minutes = digitsMatch[2] ? digitsMatch[2] : "00";

  if (ampm) {
    if (hours > 12) hours = hours % 12 || 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  if (hours >= 13 && hours <= 23) {
    return `${hours - 12}:${minutes} PM`;
  } else if (hours === 12) {
    return `12:${minutes} PM`;
  } else if (hours === 0) {
    return `12:${minutes} AM`;
  } else if (hours >= 1 && hours <= 11) {
    return `${hours}:${minutes} PM`;
  }

  return trimmed;
}

export function format12HourTime(timeStr: string): string {
  if (!timeStr || !timeStr.trim()) return "";
  // Only display the START time in 12-hour format
  const parts = timeStr.split(/\s*-\s*|\s+to\s+/i);
  return formatSingleTime12H(parts[0]);
}

/**
 * Normalizes boolean/string values for Published, Archived, Ticketed etc.
 */
export function isActiveValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (!value) return false;
  const str = String(value).trim().toLowerCase();
  return str === "yes" || str === "true" || str === "1";
}

/**
 * Shared filter for public visibility:
 * Archived = Yes -> NEVER public
 * Published = No -> NOT public
 * Published = Yes and Archived = No -> ELIGIBLE for public display
 */
export function isPublicEvent(event: {
  published: boolean;
  archived: boolean;
}): boolean {
  return event.published && !event.archived;
}

/**
 * Shared helper to get public events array
 */
export function getPublicEvents<
  T extends { published: boolean; archived: boolean },
>(events: T[]): T[] {
  return events.filter(isPublicEvent);
}

// Columns that MUST NEVER be displayed publicly or as detail fields
export const PRIVATE_ADMIN_COLUMNS = [
  "event id",
  "published",
  "archived",
  "internal notes",
  "created at",
  "last updated",
];

/**
 * Fetch and parse events from Google Sheets with cache-busting
 */
export async function fetchParsedEvents(): Promise<{
  events: ParsedEvent[];
  headers: string[];
}> {
  const cacheBusterUrl = `${SHEET_URL}&_cb=${Date.now()}`;
  const response = await fetch(cacheBusterUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch events spreadsheet: ${response.statusText}`,
    );
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText.trim()).filter((row) =>
    row.some((cell) => cell.trim() !== ""),
  );

  if (rows.length < 2) {
    return { events: [], headers: [] };
  }

  const rawHeaders = rows[0].map((h) => h.trim());
  const lowerHeaders = rawHeaders.map((h) => h.toLowerCase());

  // Locate column indices
  const getIdx = (candidates: string[]) => {
    return lowerHeaders.findIndex((h) => candidates.some((c) => h.includes(c)));
  };

  const nameIdx = getIdx(["name", "band", "artist", "event"]);
  const dayIdx = getIdx(["day"]);
  const dateIdx = getIdx(["date"]);
  const timeIdx = getIdx(["time"]);
  const ticketedIdx = getIdx(["ticketed"]);
  const ticketLinkIdx = lowerHeaders.findIndex(
    (h) =>
      h === "ticket link" ||
      h.includes("ticket link") ||
      (h.includes("link") && !h.includes("ticketed")),
  );
  const coverChargeIdx = getIdx(["cover charge", "cover"]);
  const eventIdIdx = getIdx(["event id", "id"]);
  const publishedIdx = getIdx(["published"]);
  const archivedIdx = getIdx(["archived"]);

  // Build public header list (excluding PRIVATE_ADMIN_COLUMNS)
  const publicHeaderIndices: number[] = [];
  const publicHeaders: string[] = [];

  lowerHeaders.forEach((h, idx) => {
    if (!PRIVATE_ADMIN_COLUMNS.includes(h)) {
      publicHeaderIndices.push(idx);
      publicHeaders.push(rawHeaders[idx]);
    }
  });

  const parsedEvents: ParsedEvent[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawName = nameIdx !== -1 ? row[nameIdx] || "" : "";
    const day = dayIdx !== -1 ? row[dayIdx] || "" : "";
    const dateStr = dateIdx !== -1 ? row[dateIdx] || "" : "";
    const time = timeIdx !== -1 ? row[timeIdx] || "" : "";
    const ticketedVal = ticketedIdx !== -1 ? row[ticketedIdx] || "" : "";
    const rawTicketLink = ticketLinkIdx !== -1 ? row[ticketLinkIdx] || "" : "";
    const coverCharge = coverChargeIdx !== -1 ? row[coverChargeIdx] || "" : "";
    const eventId =
      eventIdIdx !== -1 ? row[eventIdIdx] || `event-${i}` : `event-${i}`;

    const publishedVal = publishedIdx !== -1 ? row[publishedIdx] : undefined;
    const archivedVal = archivedIdx !== -1 ? row[archivedIdx] : undefined;

    // If Published column is present, check isActiveValue. If column is missing in spreadsheet, default to true.
    const published = publishedIdx !== -1 ? isActiveValue(publishedVal) : true;
    // If Archived column is present, check isActiveValue. If missing, default to false.
    const archived = archivedIdx !== -1 ? isActiveValue(archivedVal) : false;

    // Skip row if no name AND no date
    if (!rawName.trim() && !dateStr.trim()) continue;

    // Parse date in America/Chicago context without UTC conversion skew
    let parsedDate: Date | null = null;
    if (dateStr) {
      const cleaned = dateStr.trim();
      const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const slashMatch = cleaned.match(
        /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/,
      );

      if (isoMatch) {
        parsedDate = new Date(
          parseInt(isoMatch[1], 10),
          parseInt(isoMatch[2], 10) - 1,
          parseInt(isoMatch[3], 10),
          12,
          0,
          0,
        );
      } else if (slashMatch) {
        let yr = slashMatch[3]
          ? parseInt(slashMatch[3], 10)
          : new Date().getFullYear();
        if (yr < 100) yr += 2000;
        parsedDate = new Date(
          yr,
          parseInt(slashMatch[1], 10) - 1,
          parseInt(slashMatch[2], 10),
          12,
          0,
          0,
        );
      } else {
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) {
          parsedDate = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            12,
            0,
            0,
          );
        } else {
          const dWithYear = new Date(`${cleaned} ${new Date().getFullYear()}`);
          if (!isNaN(dWithYear.getTime())) {
            parsedDate = new Date(
              dWithYear.getFullYear(),
              dWithYear.getMonth(),
              dWithYear.getDate(),
              12,
              0,
              0,
            );
          }
        }
      }
    }

    // Clean ticket link
    let ticketLink = rawTicketLink.trim();
    const tlLower = ticketLink.toLowerCase();
    if (
      ["n/a", "none", "-", "tbd", "no", "false", "null", "undefined"].includes(
        tlLower,
      )
    ) {
      ticketLink = "";
    }

    if (!ticketLink) {
      for (const j of publicHeaderIndices) {
        if (j === dateIdx || j === nameIdx || j === timeIdx) continue;
        const val = (row[j] || "").trim();
        const lowerVal = val.toLowerCase();
        if (
          lowerVal &&
          (lowerVal.includes("http") ||
            lowerVal.includes(".com") ||
            lowerVal.includes(".me") ||
            lowerVal.includes("mk360"))
        ) {
          ticketLink = val;
          break;
        }
      }
    }

    const ticketed = isActiveValue(ticketedVal) || Boolean(ticketLink);

    // Additional public details
    const detailParts: { label: string; value: string }[] = [];
    for (const j of publicHeaderIndices) {
      const headerLower = (rawHeaders[j] || "").toLowerCase();
      const isTicketCol =
        headerLower.includes("ticket") || headerLower.includes("link");
      const isCoverCol =
        headerLower.includes("cover") || headerLower.includes("charge");
      const isDayCol = headerLower === "day";
      const isDateCol = headerLower.includes("date");
      const isNameCol =
        headerLower.includes("name") ||
        headerLower.includes("band") ||
        headerLower.includes("artist");
      const isTimeCol = headerLower.includes("time");

      const val = row[j]?.trim();

      if (
        !isTicketCol &&
        !isCoverCol &&
        !isDayCol &&
        !isDateCol &&
        !isNameCol &&
        !isTimeCol &&
        val &&
        val !== "-" &&
        val.toLowerCase() !== "none" &&
        val.toLowerCase() !== "n/a" &&
        val !== ticketLink
      ) {
        detailParts.push({
          label: rawHeaders[j] || `Column ${j + 1}`,
          value: val,
        });
      }
    }

    const formattedTime = format12HourTime(time);

    const publicValues = publicHeaderIndices.map((idx) => {
      if (idx === timeIdx && time) {
        return formattedTime;
      }
      return row[idx] || "";
    });

    parsedEvents.push({
      id: eventId || `event-${i}`,
      name: rawName || "Live Music",
      day,
      dateStr,
      parsedDate,
      time: formattedTime,
      ticketed,
      ticketLink,
      coverCharge,
      published,
      archived,
      publicValues,
      details: detailParts,
      raw: row,
    });
  }

  // Strictly filter for public display: Published = Yes AND Archived = No
  const publicEvents = getPublicEvents(parsedEvents);

  return { events: publicEvents, headers: publicHeaders };
}
