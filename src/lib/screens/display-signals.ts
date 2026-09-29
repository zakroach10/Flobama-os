export const SCREEN_DISPLAY_SIGNALS_SQL = "supabase/migrations/20260929000017_screen_display_signals.sql";

export type DisplayReloadSignal = {
  reloadNonce: number;
  reloadRequestedAt: string | null;
};

export function isMissingDisplaySignalRelation(message: string | null | undefined) {
  return /screen_display_signal/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function normalizeReloadNonce(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}
