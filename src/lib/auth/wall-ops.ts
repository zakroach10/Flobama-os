/** Optional server env fallback for the venue Wall & Screens Chrome app login. */
export function getWallOpsEmail(): string | null {
  const value = process.env.WALL_OPS_EMAIL?.trim().toLowerCase();
  return value || null;
}

export function isWallOpsEmail(email: string | null | undefined): boolean {
  const configured = getWallOpsEmail();
  if (!configured || !email) return false;
  return email.trim().toLowerCase() === configured;
}

export function isWallOpsUserId(
  userId: string | null | undefined,
  wallOpsUserId: string | null | undefined,
): boolean {
  return Boolean(userId && wallOpsUserId && userId === wallOpsUserId);
}

/** True when this account is the venue computer-control login. */
export function isWallOpsAccount(input: {
  userId?: string | null;
  email?: string | null;
  wallOpsUserId?: string | null;
}): boolean {
  return isWallOpsUserId(input.userId, input.wallOpsUserId) || isWallOpsEmail(input.email);
}

/** Dedicated Chrome-app console: LED wall + Screens only. */
export const WALL_OPS_MENUS = ["screens"] as const;

export function isWallOpsShell(menus: readonly string[]): boolean {
  return menus.length === 1 && menus[0] === "screens";
}

export function isMissingWallOpsColumn(message: string | null | undefined) {
  return /wall_ops_user_id/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export const WALL_OPS_SQL = "supabase/migrations/20261002000034_venue_wall_ops_user.sql";
export const WALL_OPS_LOGIN_PATH = "/wall";
export const WALL_OPS_HOME_PATH = "/screens";
