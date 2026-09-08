import type { StaffRole } from "@/lib/constants";

export function canManageProgramming(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageVenueSettings(role: StaffRole): boolean {
  return role === "admin";
}

export function isReadOnly(role: StaffRole): boolean {
  return role === "viewer";
}

export type AuthzDecision = { allowed: true } | { allowed: false; reason: string };

export function authorizeProgramming(role: StaffRole | null): AuthzDecision {
  if (!role) {
    return { allowed: false, reason: "You do not have access to this venue." };
  }
  if (!canManageProgramming(role)) {
    return { allowed: false, reason: "Your role is read-only. Viewers cannot change records." };
  }
  return { allowed: true };
}

export function authorizeVenueSettings(role: StaffRole | null): AuthzDecision {
  if (!role) {
    return { allowed: false, reason: "You do not have access to this venue." };
  }
  if (!canManageVenueSettings(role)) {
    return { allowed: false, reason: "Only admins can change venue settings." };
  }
  return { allowed: true };
}
