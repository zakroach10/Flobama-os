import type { StaffRole } from "@/lib/constants";
import { isMasterAdminEmail } from "@/lib/auth/permissions";

export const STAFF_MENUS_SQL = "supabase/migrations/20260929000014_staff_menus.sql";

export const STAFF_MENU_IDS = [
  "dashboard",
  "events",
  "booking",
  "social",
  "screens",
  "ticketing",
  "spoton",
  "artists",
  "settings",
] as const;

export type StaffMenuId = (typeof STAFF_MENU_IDS)[number];

export const STAFF_MENUS: {
  id: StaffMenuId;
  label: string;
  href: string;
  external?: boolean;
}[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "events", label: "Events", href: "/events" },
  { id: "booking", label: "Booking", href: "/booking" },
  { id: "social", label: "Social", href: "/social" },
  { id: "screens", label: "Screens", href: "/screens" },
  { id: "ticketing", label: "Ticketing", href: "/ticketing" },
  { id: "spoton", label: "Spot on BOH", href: "https://client.restaurantpos.spoton.com/b/", external: true },
  { id: "artists", label: "Artists", href: "/artists" },
  { id: "settings", label: "Settings", href: "/settings" },
];

const MENU_PREFIXES: { prefix: string; id: StaffMenuId }[] = [
  { prefix: "/admin/ticketing", id: "ticketing" },
  { prefix: "/dashboard", id: "dashboard" },
  { prefix: "/events", id: "events" },
  { prefix: "/booking", id: "booking" },
  { prefix: "/social", id: "social" },
  { prefix: "/screens", id: "screens" },
  { prefix: "/ticketing", id: "ticketing" },
  { prefix: "/artists", id: "artists" },
  { prefix: "/settings", id: "settings" },
];

export function isMissingMenusColumn(message: string | null | undefined) {
  return /menus/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function staffMenusSqlMessage(message: string) {
  if (!isMissingMenusColumn(message)) return message;
  return `Apply ${STAFF_MENUS_SQL} on the hosted database before saving menu access.`;
}

export function defaultMenusForRole(role: StaffRole): StaffMenuId[] {
  if (role === "viewer") return STAFF_MENU_IDS.filter((id) => id !== "booking" && id !== "social");
  return [...STAFF_MENU_IDS];
}

export function normalizeMenuList(value: readonly string[]): StaffMenuId[] {
  const selected = new Set(value);
  return STAFF_MENU_IDS.filter((id) => selected.has(id));
}

/** Null means the person has never had a custom menu list, so the role defaults apply. */
export function resolveMenus(stored: readonly string[] | null | undefined, role: StaffRole): StaffMenuId[] {
  if (stored == null) return defaultMenusForRole(role);
  return normalizeMenuList(stored);
}

export function sameMenus(left: readonly string[], right: readonly string[]) {
  const a = normalizeMenuList(left);
  const b = normalizeMenuList(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function hasMenu(menus: readonly string[], id: StaffMenuId) {
  return menus.includes(id);
}

export function firstMenuHref(menus: readonly string[]) {
  const enabled = new Set(menus);
  return STAFF_MENUS.find((item) => enabled.has(item.id) && !item.external)?.href ?? null;
}

export function menuForPath(pathname: string): StaffMenuId | null {
  const path = pathname.split("?")[0] || "/";
  const match = MENU_PREFIXES.find((item) => path === item.prefix || path.startsWith(`${item.prefix}/`));
  return match?.id ?? null;
}

export function authorizeMenuSelection(
  email: string | null | undefined,
  menus: readonly string[],
): { allowed: true } | { allowed: false; reason: string } {
  if (isMasterAdminEmail(email) && !sameMenus(menus, defaultMenusForRole("admin"))) {
    return { allowed: false, reason: "The master admin keeps every menu." };
  }
  return { allowed: true };
}
