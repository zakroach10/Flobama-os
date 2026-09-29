export const FLO_BAMA_VENUE_ID = "11111111-1111-4111-8111-111111111111";
export const DEFAULT_VENUE_TIMEZONE = "America/Chicago";
export const MASTER_ADMIN_EMAIL = "zak@view360.marketing";
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

export const SCREEN_TRANSITIONS = ["cut", "fade", "slide"] as const;
export type ScreenTransition = (typeof SCREEN_TRANSITIONS)[number];

export const SCREEN_TRANSITION_LABELS: Record<ScreenTransition, string> = {
  cut: "Cut",
  fade: "Fade",
  slide: "Slide",
};

export const SCREEN_WALL_MODES = ["auto", "manual"] as const;
export type ScreenWallMode = (typeof SCREEN_WALL_MODES)[number];

export const SCREEN_MEDIA_KINDS = ["image", "video", "week_events"] as const;
export type ScreenMediaKind = (typeof SCREEN_MEDIA_KINDS)[number];

export const WEEK_EVENTS_PUBLIC_URL = "dynamic://week_events";
export const WEEK_EVENTS_STORAGE_PATH = "dynamic/week_events";
export const WEEK_EVENTS_DEFAULT_SECONDS = 20;
export const VERTICAL_PLAYLIST_POLL_MS = 4000;
export const SCREEN_TAKEOVER_PRESETS = [15, 30, 60, 120, 240] as const;
export const SCREEN_TAKEOVER_MAX_MINUTES = 480;
export const SCREEN_TAKEOVER_SQL = "supabase/migrations/20260908000007_screen_takeover.sql";
export const LED_WALL_SQL = "supabase/migrations/20260928000011_led_wall.sql";
export const LED_TRIVIA_SCENE_SQL = "supabase/migrations/20260929000013_led_trivia_scene.sql";
export const LED_TRIVIA_SCENE_SEED_SQL = "supabase/migrations/20260929000015_led_trivia_scene_seed.sql";
export const LED_TRIVIA_SCENE_ID = "33333333-3333-4333-8333-333333333333";
export const LED_OBS_CLIENT_VERSION = "1.0.2";
export const LED_OBS_DMG_FILENAME = `FloBama-LED-OBS-${LED_OBS_CLIENT_VERSION}.dmg`;
export const LED_OBS_DMG_HREF = `/downloads/${LED_OBS_DMG_FILENAME}`;
export const LED_DISPLAY_POLL_MS = 1000;
export const LED_AGENT_STALE_MS = 15_000;

export const TRIVIA_SQL = "supabase/migrations/20260929000012_trivia.sql";
export const TRIVIA_PLAYER_COOKIE = "flobama_trivia_player";
export const TRIVIA_POLL_MS = 1000;
export const TRIVIA_DEFAULT_PACK_ID = "22222222-2222-4222-8222-222222222222";
export const TRIVIA_DEFAULT_LOBBY_SECONDS = 60;
export const TRIVIA_DEFAULT_QUESTION_SECONDS = 20;
export const TRIVIA_DEFAULT_QUESTION_COUNT = 10;

export const SCREEN_PLAYLISTS_SQL = "supabase/migrations/20260929000014_screen_playlists.sql";
export const MENU_SPECIAL_CATEGORIES = ["food", "drink"] as const;
export type MenuSpecialCategory = (typeof MENU_SPECIAL_CATEGORIES)[number];
export const MENU_SPECIAL_CATEGORY_LABELS: Record<MenuSpecialCategory, string> = {
  food: "Food",
  drink: "Drink",
};
export const SPECIAL_DEFAULT_SECONDS = 12;

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
