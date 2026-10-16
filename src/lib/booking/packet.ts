import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import type { BookingRecord } from "@/lib/ghl/objects";

export type BandPacketScope = "selected" | "month" | "all";

export type BandPacketSelection =
  | { scope: "all" }
  | { scope: "month"; month: string }
  | { scope: "selected"; ids: string[] };

/** YYYY-MM from a record timestamp, preferring createdAt (venue local month). */
export function recordMonthKey(record: Pick<BookingRecord, "createdAt" | "updatedAt">): string | null {
  const raw = record.createdAt || record.updatedAt;
  if (!raw) return null;
  const dt = DateTime.fromISO(raw, { zone: "utc" }).setZone(DEFAULT_VENUE_TIMEZONE);
  if (!dt.isValid) {
    const match = raw.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : null;
  }
  return dt.toFormat("yyyy-MM");
}

export function listPacketMonths(records: Array<Pick<BookingRecord, "createdAt" | "updatedAt">>): string[] {
  const months = new Set<string>();
  for (const record of records) {
    const key = recordMonthKey(record);
    if (key) months.add(key);
  }
  return [...months].sort((a, b) => b.localeCompare(a));
}

export function formatPacketMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const dt = DateTime.fromObject(
    { year: Number(match[1]), month: Number(match[2]), day: 1 },
    { zone: DEFAULT_VENUE_TIMEZONE },
  );
  return dt.isValid ? dt.toFormat("LLLL yyyy") : month;
}

export function isValidPacketMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function parseBandPacketSelection(params: {
  scope?: string | null;
  month?: string | null;
  ids?: string | null;
}): BandPacketSelection | { error: string } {
  const scope = (params.scope ?? "").trim().toLowerCase();
  const month = (params.month ?? "").trim();
  const idsRaw = (params.ids ?? "").trim();

  if (scope === "all") return { scope: "all" };

  if (scope === "month" || (!scope && month && !idsRaw)) {
    if (!isValidPacketMonth(month)) return { error: "Choose a valid month (YYYY-MM)." };
    return { scope: "month", month };
  }

  if (scope === "selected" || idsRaw) {
    const ids = [...new Set(idsRaw.split(",").map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return { error: "Select at least one submission." };
    return { scope: "selected", ids };
  }

  return { error: "Choose submissions, a month, or all." };
}

export function filterRecordsForPacket(
  records: BookingRecord[],
  selection: BandPacketSelection,
): BookingRecord[] {
  if (selection.scope === "all") {
    return [...records].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }
  if (selection.scope === "month") {
    return records
      .filter((record) => recordMonthKey(record) === selection.month)
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }
  const wanted = new Set(selection.ids);
  const byId = new Map(records.map((record) => [record.id, record]));
  return selection.ids.map((id) => byId.get(id)).filter((record): record is BookingRecord => Boolean(record && wanted.has(record.id)));
}

export function bandPacketPath(selection: BandPacketSelection, options?: { print?: boolean }): string {
  const params = new URLSearchParams();
  if (selection.scope === "all") {
    params.set("scope", "all");
  } else if (selection.scope === "month") {
    params.set("scope", "month");
    params.set("month", selection.month);
  } else {
    params.set("scope", "selected");
    params.set("ids", selection.ids.join(","));
  }
  if (options?.print) params.set("print", "1");
  return `/print/band-submissions?${params.toString()}`;
}

export function bandPacketFileName(selection: BandPacketSelection, count: number): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (selection.scope === "month") return `flobama-band-packet-${selection.month}-${count}.pdf`;
  if (selection.scope === "selected") return `flobama-band-packet-selected-${count}-${stamp}.pdf`;
  return `flobama-band-packet-all-${count}-${stamp}.pdf`;
}

export function bandPacketTitle(selection: BandPacketSelection, count: number): string {
  if (selection.scope === "month") {
    return `Band submissions · ${formatPacketMonthLabel(selection.month)} · ${count}`;
  }
  if (selection.scope === "selected") return `Band submissions · selected · ${count}`;
  return `Band submissions · all · ${count}`;
}
