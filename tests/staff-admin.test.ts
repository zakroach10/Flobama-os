import { describe, expect, it } from "vitest";
import {
  authorizeMembershipChange,
  authorizeStaffAdmin,
  authorizeVenueSettings,
  canManageStaff,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";
import { createStaffSchema } from "@/lib/validation/schemas";

describe("staff admin permissions", () => {
  it("lets only admins manage staff", () => {
    expect(canManageStaff("admin")).toBe(true);
    expect(canManageStaff("manager")).toBe(false);
    expect(canManageStaff("viewer")).toBe(false);
    expect(authorizeStaffAdmin("manager").allowed).toBe(false);
    expect(authorizeStaffAdmin("admin").allowed).toBe(true);
    expect(authorizeVenueSettings("admin").allowed).toBe(true);
  });

  it("blocks self-service role changes and last-admin removal", () => {
    expect(
      authorizeMembershipChange({
        actorId: "admin-1",
        actorRole: "admin",
        targetId: "admin-1",
        targetRole: "admin",
        nextRole: "viewer",
        adminCount: 2,
      }).allowed,
    ).toBe(false);

    expect(
      authorizeMembershipChange({
        actorId: "admin-1",
        actorRole: "admin",
        targetId: "admin-2",
        targetRole: "admin",
        removing: true,
        adminCount: 1,
      }).allowed,
    ).toBe(false);

    expect(
      authorizeMembershipChange({
        actorId: "admin-1",
        actorRole: "admin",
        targetId: "manager-1",
        targetRole: "manager",
        nextRole: "viewer",
        adminCount: 1,
      }).allowed,
    ).toBe(true);
  });

  it("blocks managers from creating staff", () => {
    const decision = authorizeMembershipChange({
      actorId: "mgr",
      actorRole: "manager",
      targetId: "other",
      targetRole: "viewer",
      nextRole: "admin",
      adminCount: 1,
    });
    expect(decision.allowed).toBe(false);
  });

  it("documents a permission for every role", () => {
    expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(0);
    expect(ROLE_PERMISSIONS.viewer.every((item) => /view/i.test(item))).toBe(true);
  });
});

describe("create staff validation", () => {
  it("requires a real email, name, role, and password", () => {
    const bad = createStaffSchema.safeParse({
      email: "not-an-email",
      displayName: "",
      role: "superuser",
      password: "short",
    });
    expect(bad.success).toBe(false);

    const good = createStaffSchema.safeParse({
      email: "door@flobama.example",
      displayName: "Door lead",
      role: "manager",
      password: "correct-horse",
    });
    expect(good.success).toBe(true);
  });
});
