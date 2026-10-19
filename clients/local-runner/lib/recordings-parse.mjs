/**
 * Filename timestamp parsers for FloBama performance recordings.
 * Inspects common date/time patterns; does not invent song titles or artists.
 */

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function buildLocalParts(year, month, day, hour, minute, second = 0) {
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second) || 0,
  };
}

/**
 * Convert local wall-clock parts in a named IANA zone to UTC ISO.
 * Handles DST gaps (invalid) and fall-back ambiguity explicitly.
 */
export function localPartsToUtcIso(parts, timeZone, { ambiguity = "earlier" } = {}) {
  // Use Intl to resolve offset without luxon in the runner.
  const { year, month, day, hour, minute, second } = parts;
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  function zoneParts(ms) {
    const map = Object.fromEntries(
      formatter.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    );
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  }

  function matches(ms) {
    const z = zoneParts(ms);
    return (
      z.year === year &&
      z.month === month &&
      z.day === day &&
      z.hour === hour &&
      z.minute === minute &&
      z.second === second
    );
  }

  // Search ±26h around the naive UTC guess for matching local interpretations.
  const candidates = [];
  for (let delta = -26 * 3600_000; delta <= 26 * 3600_000; delta += 15 * 60_000) {
    const ms = guessUtc + delta;
    // Fine-tune within the 15m window by checking exact second offsets near guess.
    if (matches(ms)) candidates.push(ms);
  }
  // Also probe minute-level around guess for exact second match.
  for (let delta = -2 * 3600_000; delta <= 2 * 3600_000; delta += 60_000) {
    const ms = guessUtc + delta;
    if (matches(ms) && !candidates.includes(ms)) candidates.push(ms);
  }
  // Second-level refine around each candidate hour
  const refined = new Set();
  for (const base of candidates.length ? candidates : [guessUtc]) {
    for (let d = -3600_000; d <= 3600_000; d += 1000) {
      const ms = base + d;
      if (matches(ms)) refined.add(ms);
    }
  }
  const unique = [...refined].sort((a, b) => a - b);

  if (unique.length === 0) {
    return {
      ok: false,
      code: "invalid_local",
      message: `Local time ${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)} does not exist in ${timeZone} (DST gap).`,
    };
  }
  if (unique.length > 1) {
    const chosen = ambiguity === "later" ? unique[unique.length - 1] : unique[0];
    return {
      ok: true,
      iso: new Date(chosen).toISOString(),
      ambiguous: true,
      interpretations: unique.map((ms) => new Date(ms).toISOString()),
      ambiguityPolicy: ambiguity,
    };
  }
  return { ok: true, iso: new Date(unique[0]).toISOString(), ambiguous: false };
}

const PATTERNS = [
  // 2026-10-17 21-30-00 / 2026-10-17_21-30-00 / 2026-10-17T21:30:00
  {
    source: "iso-like",
    confidence: "high",
    re: /(20\d{2})[-_.](\d{2})[-_.](\d{2})[ T_\-]?(\d{2})[:\-.](\d{2})(?:[:\-.](\d{2}))?/,
    map: (m) => buildLocalParts(m[1], m[2], m[3], m[4], m[5], m[6] || 0),
  },
  // 20261017_213000 / 20261017213000
  {
    source: "compact-datetime",
    confidence: "high",
    re: /(20\d{2})(\d{2})(\d{2})[_T\-]?(\d{2})(\d{2})(\d{2})?/,
    map: (m) => buildLocalParts(m[1], m[2], m[3], m[4], m[5], m[6] || 0),
  },
  // Oct 17 2026 9-30 PM / October-17-2026-9.30PM
  {
    source: "month-name",
    confidence: "medium",
    re: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ \-_.]+(\d{1,2})(?:st|nd|rd|th)?[ \-_.]+(20\d{2})[ \-_.]+(\d{1,2})[:\-.](\d{2})\s*(AM|PM|am|pm)?\b/i,
    map: (m) => {
      const month = MONTHS[m[1].toLowerCase()];
      let hour = Number(m[4]);
      const minute = Number(m[5]);
      const ampm = m[6]?.toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return buildLocalParts(m[3], month, m[2], hour, minute, 0);
    },
  },
  // Date only: 2026-10-17 or 20261017
  {
    source: "date-only",
    confidence: "low",
    re: /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?!\d)/,
    map: (m) => buildLocalParts(m[1], m[2], m[3], 0, 0, 0),
    dateOnly: true,
  },
];

/**
 * Parse a recording timestamp from an original filename (and optional relative path).
 */
export function parseRecordingFilename(filename, { timeZone = "America/Chicago", relativePath = null } = {}) {
  const haystack = [filename, relativePath].filter(Boolean).join(" / ");
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(haystack);
    if (!match) continue;
    const parts = pattern.map(match);
    if (
      !parts.year ||
      parts.month < 1 ||
      parts.month > 12 ||
      parts.day < 1 ||
      parts.day > 31 ||
      parts.hour > 23 ||
      parts.minute > 59
    ) {
      continue;
    }
    const converted = localPartsToUtcIso(parts, timeZone);
    const rawTimestampText = match[0];
    if (!converted.ok) {
      return {
        ok: false,
        rawTimestampText,
        timezone: timeZone,
        parseSource: pattern.source,
        parseConfidence: "low",
        dateOnly: Boolean(pattern.dateOnly),
        error: converted.message,
        code: converted.code,
      };
    }
    return {
      ok: true,
      parsedTimestamp: converted.iso,
      rawTimestampText,
      timezone: timeZone,
      parseSource: pattern.source,
      parseConfidence: pattern.dateOnly ? "low" : converted.ambiguous ? "medium" : pattern.confidence,
      dateOnly: Boolean(pattern.dateOnly),
      ambiguousDst: Boolean(converted.ambiguous),
      dstInterpretations: converted.interpretations || null,
    };
  }
  return {
    ok: false,
    rawTimestampText: null,
    timezone: timeZone,
    parseSource: null,
    parseConfidence: null,
    dateOnly: false,
    error: "No recognizable date/time in filename.",
  };
}
