import type { StaffRole } from "@/lib/constants";
import { MASTER_ADMIN_EMAIL, STAFF_ROLES } from "@/lib/constants";
import { isWallOpsAccount } from "@/lib/auth/wall-ops";

export const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  admin: [
    "Cannot be removed or demoted by other staff",
    "Create and remove staff",
    "Change staff roles",
    "Choose which menus each person can open",
    "Rename the venue",
    "Create and edit events and artists",
    "Update events from the master sheet",
    "Manage Booking from GoHighLevel custom objects",
    "Configure LED wall scenes and the booth client",
    "Pair and revoke display devices (Local Runner and Vertical Player)",
    "Pair and revoke the FloBama Mac camera connector",
    "Operate remote cameras and live previews",
    "Configure Production (Ecamm Live) device pairing and per-bus mute",
    "Operate Production broadcast, scenes, audio, graphics, and Zoom controls",
    "Manage vertical ads",
    "Start and end Shoals trivia; upload question spreadsheets",
    "Run Live Audience Interactor tools on the wall",
    "Configure FloBama Ticketing, table maps, comps, blocks, and refunds",
    "View the calendar and settings",
  ],
  manager: [
    "Create and edit events and artists",
    "Update events from the master sheet",
    "Manage Booking from GoHighLevel custom objects",
    "Activate LED wall scenes",
    "Operate remote cameras and live previews",
    "Operate Production broadcast, scenes, audio, graphics, and Zoom controls",
    "Manage vertical ads",
    "Publish Performance Library shows to Server Station and rename station labels",
    "Start and end Shoals trivia; upload question spreadsheets",
    "Run Live Audience Interactor tools on the wall",
    "Configure FloBama Ticketing, table maps, comps, blocks, and refunds",
    "View the staff directory",
    "View the calendar and settings",
  ],
  interactor: [
    "Run Live Audience Interactor tools on the LED wall",
    "Start audience sessions, polls, Q&A, hot takes, messages, and cards",
    "Save and reuse presets for each game mode before a show",
    "Activate the Audience Interactor LED scene",
    "Audience console only — no sidebar, dashboard, or settings",
  ],
  viewer: [
    "View only the menus an admin turns on",
    "View the calendar, artists, and staff directory",
    "View and activate LED wall scenes",
    "View camera connection status (no PTZ control)",
    "View Production status, sessions, and markers (read-only)",
    "View and run Shoals trivia",
    "View ticketing sales, orders, and check-in status without selling or refunding",
    "View settings (read-only)",
  ],
  server: [
    "Open the Server Station kiosk only",
    "Look up published event info for guests",
    "Switch LED wall scenes an admin marked for servers",
    "Play Performance Library shows an admin published for Server Station",
    "Create temporary specials, birthday, and announcement graphics",
    "Upload a picture from a phone with a QR code",
    "Cannot change settings, OBS, playlists, events, or staff",
  ],
};

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === MASTER_ADMIN_EMAIL);
}

export function canManageProgramming(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}

/** Wall & Screens booth login can run LED + vertical screen controls without opening other menus. */
export function canManageScreensControls(
  role: StaffRole,
  email?: string | null,
  options?: { userId?: string | null; wallOpsUserId?: string | null },
): boolean {
  return (
    canManageProgramming(role) ||
    isWallOpsAccount({ email, userId: options?.userId, wallOpsUserId: options?.wallOpsUserId })
  );
}

export function canConfigureLedWall(role: StaffRole): boolean {
  return role === "admin";
}

/** Upload MP4/PNG house media scenes from Screens or the FloBama Screens wall console. */
export function canUploadLedWallMedia(
  role: StaffRole,
  email?: string | null,
  options?: { userId?: string | null; wallOpsUserId?: string | null },
): boolean {
  return (
    canConfigureLedWall(role) ||
    canManageScreensControls(role, email, options)
  );
}

export function canOperateCameras(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}

export function canConfigureCameraConnector(role: StaffRole): boolean {
  return role === "admin";
}

export function canManageVenueSettings(role: StaffRole): boolean {
  return role === "admin";
}

export function canManageStaff(role: StaffRole): boolean {
  return role === "admin";
}

export function canRunAudienceInteractor(role: StaffRole): boolean {
  return role === "admin" || role === "manager" || role === "interactor";
}

export function isInteractorOnly(role: StaffRole): boolean {
  return role === "interactor";
}

export function isServerOnly(role: StaffRole): boolean {
  return role === "server";
}

export function canAccessServerStation(role: StaffRole): boolean {
  return role === "admin" || role === "manager" || role === "server";
}

export function canConfigureServerStation(role: StaffRole): boolean {
  return role === "admin";
}

/** Servers may activate artist scenes plus house scenes marked server_approved. */
export function canActivateApprovedServerScenes(role: StaffRole): boolean {
  return canAccessServerStation(role);
}

export function canCreateServerStationContent(role: StaffRole): boolean {
  return canAccessServerStation(role);
}

export function isReadOnly(role: StaffRole): boolean {
  return role === "viewer";
}

export type AuthzDecision = { allowed: true } | { allowed: false; reason: string };

function requireRole(role: StaffRole | null): AuthzDecision {
  if (!role || !STAFF_ROLES.includes(role)) {
    return { allowed: false, reason: "You do not have access to this venue." };
  }
  return { allowed: true };
}

export function authorizeLedWallActivate(role: StaffRole | null): AuthzDecision {
  if (role === "server") {
    return {
      allowed: false,
      reason: "Use Server Station LED controls for approved scenes only.",
    };
  }
  return requireRole(role);
}

export function authorizeServerStation(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canAccessServerStation(role!)) {
    return { allowed: false, reason: "Your role cannot open Server Station." };
  }
  return { allowed: true };
}

export function authorizeServerStationConfigure(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canConfigureServerStation(role!)) {
    return { allowed: false, reason: "Only admins can change Server Station settings." };
  }
  return { allowed: true };
}

export function authorizeServerStationContent(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canCreateServerStationContent(role!)) {
    return { allowed: false, reason: "Your role cannot create Server Station wall content." };
  }
  return { allowed: true };
}

export function authorizeAudienceRun(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canRunAudienceInteractor(role!)) {
    return { allowed: false, reason: "Your role cannot run Audience Interactor tools." };
  }
  return { allowed: true };
}

export function authorizeTriviaRun(role: StaffRole | null): AuthzDecision {
  if (role === "interactor") {
    return { allowed: false, reason: "Audience Interactors run the Audience console, not Shoals trivia." };
  }
  return requireRole(role);
}

export function authorizeTriviaConfigure(role: StaffRole | null): AuthzDecision {
  return authorizeProgramming(role);
}

export function authorizeLedWallConfigure(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canConfigureLedWall(role!)) {
    return { allowed: false, reason: "Only admins can configure LED wall scenes." };
  }
  return { allowed: true };
}

export function authorizeLedWallMediaUpload(
  role: StaffRole | null,
  email?: string | null,
  options?: { userId?: string | null; wallOpsUserId?: string | null },
): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canUploadLedWallMedia(role!, email, options)) {
    return { allowed: false, reason: "Your role cannot upload LED wall media scenes." };
  }
  return { allowed: true };
}

/** Push update reloads the paired local runner. Wall ops and programming staff can send it. */
export function authorizeDisplaySafeRefresh(
  role: StaffRole | null,
  email?: string | null,
  options?: { userId?: string | null; wallOpsUserId?: string | null },
): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canManageScreensControls(role!, email, options)) {
    return { allowed: false, reason: "Your role cannot push an update to the local runner." };
  }
  return { allowed: true };
}

/** Viewers and above can open Production; servers/interactors denied by default. */
export function canViewProduction(role: StaffRole): boolean {
  return role === "admin" || role === "manager" || role === "viewer";
}

/** Managers and admins can enqueue Ecamm control commands. */
export function canOperateProduction(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}

/** Admins configure the production Mac, favorites policy, and per-bus mute. */
export function canConfigureProduction(role: StaffRole): boolean {
  return role === "admin";
}

export function authorizeProductionView(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canViewProduction(role!)) {
    return { allowed: false, reason: "Your role cannot open Production." };
  }
  return { allowed: true };
}

export function authorizeProductionControl(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canOperateProduction(role!)) {
    return { allowed: false, reason: "Your role can view Production but cannot control Ecamm." };
  }
  return { allowed: true };
}

export function authorizeProductionConfigure(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canConfigureProduction(role!)) {
    return { allowed: false, reason: "Only admins can configure Production device settings." };
  }
  return { allowed: true };
}

/** Admins/managers configure recordings sources and correct event matches. */
export function authorizePerformanceConfigure(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!(role === "admin" || role === "manager")) {
    return { allowed: false, reason: "Only admins and managers can configure the Performance Library." };
  }
  return { allowed: true };
}

/** Operators who can control LED playback can queue/play performances. */
export function authorizePerformancePlayback(
  role: StaffRole | null,
  email?: string | null,
  options?: { userId?: string | null; wallOpsUserId?: string | null },
): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canManageScreensControls(role!, email, options)) {
    return { allowed: false, reason: "Your role cannot control Performance Library playback." };
  }
  return { allowed: true };
}

export function authorizeCameraView(role: StaffRole | null): AuthzDecision {
  return requireRole(role);
}

export function authorizeCameraOperate(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canOperateCameras(role!)) {
    return { allowed: false, reason: "Your role can view cameras but cannot operate them." };
  }
  return { allowed: true };
}

export function authorizeCameraConfigure(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canConfigureCameraConnector(role!)) {
    return { allowed: false, reason: "Only admins can pair or revoke the Mac connector." };
  }
  return { allowed: true };
}

export function authorizeProgramming(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (role === "server") {
    return { allowed: false, reason: "Servers cannot change event programming." };
  }
  if (!canManageProgramming(role!)) {
    return { allowed: false, reason: "Your role is read-only. Viewers cannot change records." };
  }
  return { allowed: true };
}

export function authorizeVenueSettings(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canManageVenueSettings(role!)) {
    return { allowed: false, reason: "Only admins can change venue settings." };
  }
  return { allowed: true };
}

export function authorizeStaffAdmin(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
  if (!canManageStaff(role!)) {
    return { allowed: false, reason: "Only admins can create staff or change roles." };
  }
  return { allowed: true };
}

export function authorizeMembershipChange(input: {
  actorId: string;
  actorRole: StaffRole | null;
  targetId: string;
  targetRole: StaffRole;
  targetEmail?: string | null;
  nextRole?: StaffRole;
  removing?: boolean;
  adminCount: number;
}): AuthzDecision {
  const allowed = authorizeStaffAdmin(input.actorRole);
  if (!allowed.allowed) return allowed;

  if (isMasterAdminEmail(input.targetEmail)) {
    const losesAdmin = input.removing || (input.nextRole !== undefined && input.nextRole !== "admin");
    if (losesAdmin) {
      return { allowed: false, reason: "The master admin cannot be removed or demoted." };
    }
  }

  if (input.actorId === input.targetId) {
    return { allowed: false, reason: "You cannot change or remove your own access." };
  }

  const losesAdmin = input.removing || (input.nextRole !== undefined && input.nextRole !== "admin");
  if (input.targetRole === "admin" && input.adminCount <= 1 && losesAdmin) {
    return { allowed: false, reason: "The venue must keep at least one admin." };
  }

  return { allowed: true };
}
