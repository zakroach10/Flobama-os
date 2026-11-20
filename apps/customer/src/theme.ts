export const colors = {
  bg: "#100e0c",
  raised: "#1a1612",
  card: "#241e18",
  line: "#3c322a",
  text: "#f6f0e6",
  muted: "#cbbfb2",
  gold: "#f0b429",
  orange: "#e36a1e",
  red: "#e23b32",
  ink: "#140f0c",
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const type = {
  display: 40,
  title: 28,
  card: 20,
  body: 16,
  small: 14,
  label: 12,
} as const;

export const fonts = {
  display: "Syne_800ExtraBold",
  displaySoft: "Syne_700Bold",
  text: "Outfit_400Regular",
  textMedium: "Outfit_500Medium",
  textStrong: "Outfit_600SemiBold",
} as const;

const chicago = { timeZone: "America/Chicago" } as const;

export function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { ...chicago, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function isSameVenueDay(iso: string, now: Date = new Date()) {
  return dayKey(iso) === dayKey(now.toISOString());
}

export function formatDayLabel(iso: string, now: Date = new Date()) {
  if (isSameVenueDay(iso, now)) return "Today";
  return new Intl.DateTimeFormat("en-US", { ...chicago, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatDayMarker(iso: string) {
  const date = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { ...chicago, weekday: "short" }).format(date),
    day: new Intl.DateTimeFormat("en-US", { ...chicago, day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { ...chicago, month: "short" }).format(date),
  };
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat("en-US", { ...chicago, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatWhen(iso: string) {
  return `${formatDayLabel(iso)} · ${formatClock(iso)}`;
}

export function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export const apiBase = (process.env.EXPO_PUBLIC_FLOBAMA_API_URL || "http://localhost:43123").replace(/\/$/, "");
