import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  authorizeMembershipChange,
  authorizeStaffAdmin,
  authorizeVenueSettings,
  canManageStaff,
  isMasterAdminEmail,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  STAFF_MENU_IDS,
  STAFF_MENUS_SQL,
  authorizeMenuSelection,
  defaultMenusForRole,
  firstMenuHref,
  isAudienceOnlyShell,
  menuForPath,
  menusForRole,
  resolveMenus,
  sameMenus,
} from "@/lib/auth/menus";
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

  it("blocks removing or demoting the master admin even when other admins exist", () => {
    expect(isMasterAdminEmail("zak@view360.marketing")).toBe(true);
    expect(isMasterAdminEmail("ZAK@VIEW360.MARKETING")).toBe(true);
    expect(isMasterAdminEmail("other@example.com")).toBe(false);

    expect(
      authorizeMembershipChange({
        actorId: "other-admin",
        actorRole: "admin",
        targetId: "zak",
        targetRole: "admin",
        targetEmail: "zak@view360.marketing",
        removing: true,
        adminCount: 3,
      }).allowed,
    ).toBe(false);

    expect(
      authorizeMembershipChange({
        actorId: "other-admin",
        actorRole: "admin",
        targetId: "zak",
        targetRole: "admin",
        targetEmail: "zak@view360.marketing",
        nextRole: "viewer",
        adminCount: 3,
      }).allowed,
    ).toBe(false);
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
      menus: ["dashboard", "programming"],
    });
    expect(good.success).toBe(true);
  });
});

describe("staff menu access", () => {
  it("starts viewers without booking/social/audience, interactors with audience only", () => {
    expect(defaultMenusForRole("viewer")).not.toContain("booking");
    expect(defaultMenusForRole("viewer")).not.toContain("social");
    expect(defaultMenusForRole("viewer")).not.toContain("audience");
    expect(defaultMenusForRole("viewer")).toContain("screens");
    expect(defaultMenusForRole("interactor")).toEqual(["audience"]);
    expect(resolveMenus(["dashboard", "settings"], "interactor")).toEqual(["audience"]);
    expect(defaultMenusForRole("admin")).toEqual([...STAFF_MENU_IDS]);
    expect(defaultMenusForRole("manager")).toEqual([...STAFF_MENU_IDS]);
  });

  it("keeps a saved list, including an empty one, and falls back only when nothing is saved", () => {
    expect(resolveMenus(null, "viewer")).toEqual(defaultMenusForRole("viewer"));
    expect(resolveMenus(undefined, "admin")).toEqual(defaultMenusForRole("admin"));
    expect(resolveMenus([], "admin")).toEqual([]);
    expect(resolveMenus(["settings", "nope", "programming"], "viewer")).toEqual(["programming", "settings"]);
  });

  it("sends a disabled menu to the first menu that is still on", () => {
    expect(menuForPath("/programming/123/tables")).toBe("programming");
    expect(menuForPath("/admin/ticketing/check-in/1")).toBe("ticketing");
    expect(menuForPath("/booth")).toBeNull();
    expect(firstMenuHref(["spoton", "settings"])).toBe("/settings");
    expect(firstMenuHref([])).toBeNull();
    expect(sameMenus(["settings", "programming"], ["programming", "settings"])).toBe(true);
  });

  it("keeps every menu on for the master admin", () => {
    expect(authorizeMenuSelection("zak@view360.marketing", ["dashboard"]).allowed).toBe(false);
    expect(authorizeMenuSelection("zak@view360.marketing", defaultMenusForRole("admin")).allowed).toBe(true);
    expect(authorizeMenuSelection("door@flobama.example", ["programming"]).allowed).toBe(true);
  });

  it("stores the same menu ids the database accepts", () => {
    const sql = readFileSync(STAFF_MENUS_SQL, "utf8");
    for (const id of STAFF_MENU_IDS) expect(sql).toContain(`'${id}'`);
  });

  it("locks interactors to the audience console shell", () => {
    expect(menusForRole("interactor", ["dashboard", "settings"])).toEqual(["audience"]);
    expect(menusForRole("manager", ["screens", "settings"])).toEqual(["screens", "settings"]);
    expect(isAudienceOnlyShell(["audience"])).toBe(true);
    expect(isAudienceOnlyShell(["audience", "settings"])).toBe(false);
    expect(firstMenuHref(defaultMenusForRole("interactor"))).toBe("/audience");
  });
});
