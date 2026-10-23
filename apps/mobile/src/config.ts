/**
 * Guest mobile configuration.
 * Public API base URL comes from EXPO_PUBLIC_API_BASE_URL (see .env.example).
 * Never put service-role keys or staff secrets in EXPO_PUBLIC_* variables.
 */

const DEFAULT_API_BASE = "https://flobama-os.vercel.app";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const API_BASE_URL = trimSlash(
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_BASE_URL?.trim()) ||
    DEFAULT_API_BASE,
);

/** Single shared ordering destination for Tonight + Order tab. */
export const ORDERING_URL = "https://mk360.me/flobamaorder";

export const VENUE_TIMEZONE = "America/Chicago";
export const VENUE_TIMEZONE_LABEL = "Central Time";

export const SITE_EVENTS_URL = `${API_BASE_URL}/events`;
export const SITE_PRIVACY_URL = `${API_BASE_URL}/privacy-policy`;
export const SITE_CONTACT_URL = `${API_BASE_URL}/contact`;

/** Verified from existing FloBama OS public site contact page. */
export const VENUE = {
  name: "FloBama Music Hall",
  legalName: "FloBama Restaurant and Music Hall",
  street: "311 N. Court Street",
  cityStateZip: "Florence, AL 35630",
  phoneDisplay: "256-764-2225",
  phoneTel: "2567642225",
  email: "bart@flobamadowntown.com",
  mapsUrl:
    "https://maps.apple.com/?q=FloBama%20Music%20Hall%20311%20N%20Court%20Street%20Florence%20AL%2035630",
  googleMapsUrl:
    "https://www.google.com/maps/search/?api=1&query=311+N+Court+Street+Florence+AL+35630",
} as const;
