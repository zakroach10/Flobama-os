import type { StaffRole } from "@/lib/constants";
import { MASTER_ADMIN_EMAIL, STAFF_ROLES } from "@/lib/constants";

export const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  admin: [
    "Cannot be removed or demoted by other staff",
    "Create and remove staff",
    "Change staff roles",
    "Rename the venue",
    "Create and edit events and artists",
    "Update events from the master sheet",
    "Manage Booking from GoHighLevel custom objects",
    "Manage LED wall scenes and vertical ads",
    "Configure FloBama Ticketing, table maps, comps, blocks, and refunds",
    "View the calendar and settings",
  ],
  manager: [
    "Create and edit events and artists",
    "Update events from the master sheet",
    "Manage Booking from GoHighLevel custom objects",
    "Manage LED wall scenes and vertical ads",
    "Configure FloBama Ticketing, table maps, comps, blocks, and refunds",
    "View the staff directory",
    "View the calendar and settings",
  ],
  viewer: [
    "View the calendar, artists, and staff directory",
    "View ticketing sales, orders, and check-in status without selling or refunding",
    "View settings (read-only)",
  ],
};

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === MASTER_ADMIN_EMAIL);
}

export function canManageProgramming(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageVenueSettings(role: StaffRole): boolean {
  return role === "admin";
}

export function canManageStaff(role: StaffRole): boolean {
  return role === "admin";
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

export function authorizeProgramming(role: StaffRole | null): AuthzDecision {
  const access = requireRole(role);
  if (!access.allowed) return access;
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
