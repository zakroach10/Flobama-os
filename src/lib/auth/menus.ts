import type { StaffRole } from "@/lib/constants";
import { isMasterAdminEmail } from "@/lib/auth/permissions";

export const STAFF_MENUS_SQL = "supabase/migrations/20261002000033_staff_menus_known.sql";

export const STAFF_MENU_IDS = [
  "dashboard",
  "programming",
  "booking",
  "social",
  "audience",
  "screens",
  "cameras",
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
  { id: "programming", label: "Programming", href: "/programming" },
  { id: "booking", label: "Booking", href: "/booking" },
  { id: "social", label: "Social", href: "/social" },
  { id: "audience", label: "Audience", href: "/audience" },
  { id: "screens", label: "Screens", href: "/screens" },
  { id: "cameras", label: "Cameras", href: "/cameras" },
  { id: "ticketing", label: "Ticketing", href: "/ticketing" },
  { id: "spoton", label: "Spot on BOH", href: "https://client.restaurantpos.spoton.com/b/", external: true },
  { id: "artists", label: "Artists", href: "/artists" },
  { id: "settings", label: "Settings", href: "/settings" },
];

const MENU_PREFIXES: { prefix: string; id: StaffMenuId }[] = [
  { prefix: "/admin/ticketing", id: "ticketing" },
  { prefix: "/dashboard", id: "dashboard" },
  { prefix: "/programming", id: "programming" },
  { prefix: "/events", id: "programming" },
  { prefix: "/booking", id: "booking" },
  { prefix: "/social", id: "social" },
  { prefix: "/audience", id: "audience" },
  { prefix: "/screens", id: "screens" },
  { prefix: "/cameras", id: "cameras" },
  { prefix: "/ticketing", id: "ticketing" },
  { prefix: "/artists", id: "artists" },
  { prefix: "/settings", id: "settings" },
];

export function isMissingMenusColumn(message: string | null | undefined) {
  return /menus/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function isMenusKnownConstraintError(message: string | null | undefined) {
  return /venue_memberships_menus_known|check constraint.*menus_known/i.test(message ?? "");
}

export function staffMenusSqlMessage(message: string) {
  if (!isMissingMenusColumn(message) && !isMenusKnownConstraintError(message)) return message;
  return `Apply ${STAFF_MENUS_SQL} on the hosted database before saving menu access.`;
}

export function defaultMenusForRole(role: StaffRole): StaffMenuId[] {
  if (role === "interactor") {
    return ["audience"];
  }
  if (role === "viewer") {
    return STAFF_MENU_IDS.filter(
      (id) => id !== "booking" && id !== "social" && id !== "audience",
    );
  }
  return [...STAFF_MENU_IDS];
}

export function normalizeMenuList(value: readonly string[]): StaffMenuId[] {
  const selected = new Set(value);
  return STAFF_MENU_IDS.filter((id) => selected.has(id));
}

/** Audience Interactors always land on the Audience console only — no sidebar menus. */
export function menusForRole(role: StaffRole, menus: readonly string[]): StaffMenuId[] {
  if (role === "interactor") return ["audience"];
  return normalizeMenuList(menus);
}

/** Null means the person has never had a custom menu list, so the role defaults apply. */
export function resolveMenus(stored: readonly string[] | null | undefined, role: StaffRole): StaffMenuId[] {
  if (role === "interactor") return defaultMenusForRole(role);
  if (stored == null) return defaultMenusForRole(role);
  return normalizeMenuList(stored);
}

export function isAudienceOnlyShell(menus: readonly string[]) {
  return menus.length === 1 && menus[0] === "audience";
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
