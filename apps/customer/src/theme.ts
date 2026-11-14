export const colors = {
  bg: "#0c0c0c",
  card: "#171717",
  line: "#2a2a2a",
  text: "#f7f1e8",
  muted: "#b7aea4",
  gold: "#f0b429",
  orange: "#e36a1e",
  red: "#e23b32",
  black: "#000000",
};

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export const apiBase = (process.env.EXPO_PUBLIC_FLOBAMA_API_URL || "http://localhost:43123").replace(/\/$/, "");
