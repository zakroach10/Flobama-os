/** Optional server env: exact staff email for the venue Wall & Screens Chrome app login. */
export function getWallOpsEmail(): string | null {
  const value = process.env.WALL_OPS_EMAIL?.trim().toLowerCase();
  return value || null;
}

export function isWallOpsEmail(email: string | null | undefined): boolean {
  const configured = getWallOpsEmail();
  if (!configured || !email) return false;
  return email.trim().toLowerCase() === configured;
}

/** Dedicated Chrome-app console: LED wall + Screens only. */
export const WALL_OPS_MENUS = ["screens"] as const;

export function isWallOpsShell(menus: readonly string[]): boolean {
  return menus.length === 1 && menus[0] === "screens";
}

export const WALL_OPS_LOGIN_PATH = "/wall";
export const WALL_OPS_HOME_PATH = "/screens";
