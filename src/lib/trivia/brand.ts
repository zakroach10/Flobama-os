export type TriviaPackBrand = {
  background: string;
  text: string;
  accent: string;
  muted: string;
  mutedStrong: string;
  logoUrl: string | null;
};

export const DEFAULT_TRIVIA_BRAND: TriviaPackBrand = {
  background: "#1b1612",
  text: "#f7f1ea",
  accent: "#d36b4a",
  muted: "#cbb7a8",
  mutedStrong: "#8a7368",
  logoUrl: null,
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isTriviaBrandHex(value: string) {
  return HEX_RE.test(value.trim());
}

export function normalizeTriviaBrandHex(value: string, fallback: string) {
  const trimmed = value.trim();
  return isTriviaBrandHex(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function triviaBrandFromPackRow(row: {
  brand_background?: string | null;
  brand_text?: string | null;
  brand_accent?: string | null;
  brand_muted?: string | null;
  brand_muted_strong?: string | null;
  brand_logo_url?: string | null;
} | null | undefined): TriviaPackBrand {
  return {
    background: normalizeTriviaBrandHex(row?.brand_background ?? "", DEFAULT_TRIVIA_BRAND.background),
    text: normalizeTriviaBrandHex(row?.brand_text ?? "", DEFAULT_TRIVIA_BRAND.text),
    accent: normalizeTriviaBrandHex(row?.brand_accent ?? "", DEFAULT_TRIVIA_BRAND.accent),
    muted: normalizeTriviaBrandHex(row?.brand_muted ?? "", DEFAULT_TRIVIA_BRAND.muted),
    mutedStrong: normalizeTriviaBrandHex(row?.brand_muted_strong ?? "", DEFAULT_TRIVIA_BRAND.mutedStrong),
    logoUrl: row?.brand_logo_url?.trim() || null,
  };
}

/** CSS custom properties for wall / kiosk / phone play surfaces. */
export function triviaBrandCssVars(brand: TriviaPackBrand): Record<string, string> {
  return {
    "--trivia-bg": brand.background,
    "--trivia-text": brand.text,
    "--trivia-accent": brand.accent,
    "--trivia-muted": brand.muted,
    "--trivia-muted-strong": brand.mutedStrong,
  };
}

/** Accent as rgba for radial washes — assumes #rrggbb. */
export function triviaAccentRgba(accent: string, alpha: number) {
  const hex = normalizeTriviaBrandHex(accent, DEFAULT_TRIVIA_BRAND.accent).slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
