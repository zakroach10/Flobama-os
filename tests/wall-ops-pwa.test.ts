import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  withPersistentAuthCookieOptions,
} from "@/lib/auth/session-cookies";
import { WALL_OPS_HOME_PATH, WALL_OPS_LOGIN_PATH } from "@/lib/auth/wall-ops";
import { WALL_OPS_PWA_MANIFEST_PATH, WALL_OPS_PWA_NAME, wallOpsPwaMetadata } from "@/lib/pwa/wall-ops";
import {
  isWallOpsStation,
  WALL_OPS_STATION_LABELS,
  WALL_OPS_STATIONS,
} from "@/lib/screens/wall-ops-station";

describe("FloBama Screens PWA manifest", () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "public/wall.webmanifest"), "utf8")) as {
    id: string;
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };

  it("uses the FloBama Screens branding and standalone launch", () => {
    expect(manifest.name).toBe(WALL_OPS_PWA_NAME);
    expect(manifest.short_name).toBe(WALL_OPS_PWA_NAME);
    expect(manifest.id).toBe(WALL_OPS_LOGIN_PATH);
    expect(manifest.start_url).toBe(WALL_OPS_LOGIN_PATH);
    expect(manifest.display).toBe("standalone");
    expect(WALL_OPS_HOME_PATH).toBe("/screens");
  });

  it("ships square and maskable icons at required sizes", () => {
    const sizes = new Set(manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`));
    expect(sizes.has("192x192:any")).toBe(true);
    expect(sizes.has("512x512:any")).toBe(true);
    expect(sizes.has("192x192:maskable")).toBe(true);
    expect(sizes.has("512x512:maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const bytes = readFileSync(join(process.cwd(), "public", icon.src.replace(/^\//, "")));
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
  });

  it("exposes shared metadata helpers for /wall and /screens", () => {
    expect(wallOpsPwaMetadata.manifest).toBe(WALL_OPS_PWA_MANIFEST_PATH);
    expect(wallOpsPwaMetadata.applicationName).toBe(WALL_OPS_PWA_NAME);
  });
});

describe("persistent auth cookies", () => {
  it("forces a long-lived maxAge when cookies would otherwise be session-only", () => {
    expect(withPersistentAuthCookieOptions({ path: "/" }).maxAge).toBe(AUTH_COOKIE_MAX_AGE_SECONDS);
    expect(withPersistentAuthCookieOptions({ maxAge: 0 }).maxAge).toBe(AUTH_COOKIE_MAX_AGE_SECONDS);
    expect(withPersistentAuthCookieOptions({ maxAge: 3600 }).maxAge).toBe(3600);
  });
});

describe("wall ops station preferences", () => {
  it("only accepts known station ids and labels them for operators", () => {
    expect(WALL_OPS_STATIONS).toEqual(["sound-booth", "back-office"]);
    expect(isWallOpsStation("sound-booth")).toBe(true);
    expect(isWallOpsStation("stage")).toBe(false);
    expect(WALL_OPS_STATION_LABELS["back-office"]).toBe("Back Office");
  });
});

describe("wall service worker safety", () => {
  it("does not cache HTML navigations or API traffic", () => {
    const source = readFileSync(join(process.cwd(), "public/wall-sw.js"), "utf8");
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("text/html");
    expect(source).not.toMatch(/cache\.put\([^\)]*navigate/);
    expect(source).toContain("/_next/static/");
    expect(source).toContain("/icons/");
  });
});
