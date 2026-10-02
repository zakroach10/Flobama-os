import { afterEach, describe, expect, it } from "vitest";
import { authorizeMenuSelection, defaultMenusForRole, firstMenuHref, isWallOpsShell } from "@/lib/auth/menus";
import { canManageScreensControls } from "@/lib/auth/permissions";
import { getWallOpsEmail, isWallOpsEmail, WALL_OPS_HOME_PATH, WALL_OPS_MENUS } from "@/lib/auth/wall-ops";

describe("wall ops login", () => {
  const previous = process.env.WALL_OPS_EMAIL;

  afterEach(() => {
    if (previous === undefined) delete process.env.WALL_OPS_EMAIL;
    else process.env.WALL_OPS_EMAIL = previous;
  });

  it("matches the configured wall ops email", () => {
    process.env.WALL_OPS_EMAIL = "wall@flobama.example";
    expect(getWallOpsEmail()).toBe("wall@flobama.example");
    expect(isWallOpsEmail("Wall@Flobama.Example")).toBe(true);
    expect(isWallOpsEmail("other@flobama.example")).toBe(false);
  });

  it("uses a screens-only shell and home path", () => {
    expect(isWallOpsShell(WALL_OPS_MENUS)).toBe(true);
    expect(isWallOpsShell(["screens", "settings"])).toBe(false);
    expect(firstMenuHref(WALL_OPS_MENUS)).toBe(WALL_OPS_HOME_PATH);
  });

  it("keeps the wall ops login on Screens only", () => {
    process.env.WALL_OPS_EMAIL = "wall@flobama.example";
    expect(authorizeMenuSelection("wall@flobama.example", ["dashboard"]).allowed).toBe(false);
    expect(authorizeMenuSelection("wall@flobama.example", WALL_OPS_MENUS).allowed).toBe(true);
    expect(authorizeMenuSelection("door@flobama.example", ["screens", "settings"]).allowed).toBe(true);
  });

  it("lets the wall ops login run screen controls even as a viewer", () => {
    process.env.WALL_OPS_EMAIL = "wall@flobama.example";
    expect(canManageScreensControls("viewer", "wall@flobama.example")).toBe(true);
    expect(canManageScreensControls("viewer", "door@flobama.example")).toBe(false);
    expect(canManageScreensControls("manager", "door@flobama.example")).toBe(true);
    expect(defaultMenusForRole("viewer")).toContain("screens");
  });
});
