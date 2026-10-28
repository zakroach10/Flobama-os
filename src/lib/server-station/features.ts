export const SERVER_STATION_MENU_KEYS = [
  "events",
  "wall",
  "performances",
  "specials",
  "birthday",
  "message",
  "upload",
  "youtube",
  "active",
] as const;

export type ServerStationMenuKey = (typeof SERVER_STATION_MENU_KEYS)[number];

export type ServerStationMenusEnabled = Record<ServerStationMenuKey, boolean>;

export const DEFAULT_SERVER_STATION_MENUS_ENABLED: ServerStationMenusEnabled = {
  events: true,
  wall: true,
  performances: true,
  specials: true,
  birthday: true,
  message: true,
  upload: true,
  youtube: true,
  active: true,
};

export const SERVER_STATION_MENU_LABELS: Record<ServerStationMenuKey, string> = {
  events: "Explore Events",
  wall: "LED Wall",
  performances: "Performances",
  specials: "Food & Drink",
  birthday: "Celebration",
  message: "Custom Message",
  upload: "Phone Upload Library",
  youtube: "YouTube",
  active: "Your Rotation",
};

export const SERVER_STATION_MENU_PATHS: Record<ServerStationMenuKey, string> = {
  events: "/server/events",
  wall: "/server/wall",
  performances: "/server/performances",
  specials: "/server/specials",
  birthday: "/server/birthday",
  message: "/server/message",
  upload: "/server/upload",
  youtube: "/server/youtube",
  active: "/server/active",
};

export function normalizeServerStationMenusEnabled(raw: unknown): ServerStationMenusEnabled {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_SERVER_STATION_MENUS_ENABLED };
  for (const key of SERVER_STATION_MENU_KEYS) {
    if (typeof source[key] === "boolean") next[key] = source[key];
  }
  return next;
}

export function isServerStationMenuEnabled(
  menus: ServerStationMenusEnabled | null | undefined,
  key: ServerStationMenuKey,
) {
  if (!menus) return true;
  return menus[key] !== false;
}

export function menuKeyForServerStationPath(path: string): ServerStationMenuKey | null {
  if (path === "/server" || path === "/server/") return null;
  for (const key of SERVER_STATION_MENU_KEYS) {
    const href = SERVER_STATION_MENU_PATHS[key];
    if (path === href || path.startsWith(`${href}/`)) return key;
  }
  return null;
}
