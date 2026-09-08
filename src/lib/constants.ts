export const FLO_BAMA_VENUE_ID = "11111111-1111-4111-8111-111111111111";
export const DEFAULT_VENUE_TIMEZONE = "America/Chicago";
export const EVENT_PAGE_SIZE = 20;
export const ARTIST_PAGE_SIZE = 20;

export const STAFF_ROLES = ["admin", "manager", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VISIBILITIES = ["public", "private"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_TYPES = [
  "live_music",
  "karaoke",
  "dj",
  "sports",
  "private_event",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  live_music: "Live music",
  karaoke: "Karaoke",
  dj: "DJ",
  sports: "Sports",
  private_event: "Private event",
  other: "Other",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
};

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  public: "Public",
  private: "Private",
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export type RequiredPublicEnvName = (typeof REQUIRED_PUBLIC_ENV)[number];
