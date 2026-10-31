import type { StaffRole } from "@/lib/constants";
import { isAudienceOnlyShell, isServerStationShell } from "@/lib/auth/menus";
import { authorizeLedWallActivate, canManageProgramming } from "@/lib/auth/permissions";

/** Staff shell chat. Audience and Server Station consoles keep their own controls. */
export function showStaffAssistant(menus: readonly string[], role: StaffRole): boolean {
  if (isAudienceOnlyShell(menus) || isServerStationShell(menus)) return false;
  if (canManageProgramming(role)) return true;
  return authorizeLedWallActivate(role).allowed;
}
