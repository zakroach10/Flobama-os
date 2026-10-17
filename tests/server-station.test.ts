import { describe, expect, it } from "vitest";
import {
  canAccessServerStation,
  canConfigureServerStation,
  authorizeServerStation,
  authorizeLedWallActivate,
  authorizeProgramming,
  isServerOnly,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  defaultMenusForRole,
  isServerStationShell,
  menusForRole,
  resolveMenus,
  authorizeMenuSelection,
} from "@/lib/auth/menus";
import {
  hashServerStationPin,
  createServerStationPinSalt,
  verifyServerStationPin,
  pinLockUntil,
  issueServerStationStaffCookie,
  verifyServerStationStaffCookie,
} from "@/lib/auth/server-station";
import {
  validateGuestDisplayName,
  validateServerStationMessage,
  validateSpecialCopy,
} from "@/lib/server-station/moderation";
import { resolveServerStationEndsAt, durationPresetLabel } from "@/lib/server-station/expiration";
import { buildServerStationGraphicModel, celebrationBadge } from "@/lib/server-station/templates";
import { detectServerStationUploadKind } from "@/lib/server-station/upload-kinds";
import {
  isServerStationActivatableScene,
  paginateServerStationScenes,
  resolveLedScenePreviewUrl,
  SERVER_STATION_SCENE_PAGE_SIZE,
} from "@/lib/server-station/scenes";
import { wallStatusLabel } from "@/lib/server-station/wall-status-shared";
import { canAutoArtistCut } from "@/lib/screens/led-wall-automation";
import {
  SERVER_STATION_HOME_PATH,
  SERVER_STATION_LOGIN_PATH,
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
} from "@/lib/constants";
import {
  SERVER_STATION_PWA_MANIFEST_PATH,
  SERVER_STATION_PWA_NAME,
  serverStationPwaMetadata,
} from "@/lib/pwa/server-station";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("server role and menus", () => {
  it("includes server in staff roles", () => {
    expect(STAFF_ROLES).toContain("server");
    expect(STAFF_ROLE_LABELS.server).toBe("Server");
    expect(ROLE_PERMISSIONS.server.length).toBeGreaterThan(0);
  });

  it("locks server accounts to Server Station only", () => {
    expect(defaultMenusForRole("server")).toEqual(["server"]);
    expect(menusForRole("server", ["dashboard", "settings"])).toEqual(["server"]);
    expect(resolveMenus(["screens"], "server")).toEqual(["server"]);
    expect(isServerStationShell(["server"])).toBe(true);
    expect(isServerOnly("server")).toBe(true);
    expect(
      authorizeMenuSelection("server@example.com", ["dashboard"], { role: "server" }).allowed,
    ).toBe(false);
  });

  it("lets admin/manager/server into Server Station and blocks viewers", () => {
    expect(canAccessServerStation("admin")).toBe(true);
    expect(canAccessServerStation("manager")).toBe(true);
    expect(canAccessServerStation("server")).toBe(true);
    expect(canAccessServerStation("viewer")).toBe(false);
    expect(canConfigureServerStation("admin")).toBe(true);
    expect(canConfigureServerStation("manager")).toBe(false);
    expect(authorizeServerStation("viewer").allowed).toBe(false);
  });

  it("blocks servers from programming writes and unrestricted LED activate", () => {
    expect(authorizeProgramming("server").allowed).toBe(false);
    expect(authorizeLedWallActivate("server").allowed).toBe(false);
  });
});

describe("server station PIN session", () => {
  it("hashes and verifies PINs", () => {
    const salt = createServerStationPinSalt();
    const hash = hashServerStationPin("2468", salt);
    expect(verifyServerStationPin("2468", salt, hash)).toBe(true);
    expect(verifyServerStationPin("0000", salt, hash)).toBe(false);
  });

  it("locks after too many attempts", () => {
    expect(pinLockUntil(4)).toBeNull();
    expect(pinLockUntil(5)).toMatch(/T/);
  });

  it("issues and verifies staff cookies when a signing secret exists", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-server-station-secret";
    const cookie = issueServerStationStaffCookie(
      {
        venueId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        deviceId: null,
        displayName: "Alex",
      },
      180,
    );
    expect(cookie).toBeTruthy();
    const verified = verifyServerStationStaffCookie(cookie);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.session.displayName).toBe("Alex");
    }
    process.env.CRON_SECRET = previous;
  });
});

describe("server station content validation", () => {
  it("validates birthday names and blocks prohibited wording", () => {
    expect(validateGuestDisplayName("Jessica").ok).toBe(true);
    expect(validateGuestDisplayName("fuck").ok).toBe(false);
    expect(validateServerStationMessage({ headline: "Welcome UNA Alumni!" }).ok).toBe(true);
    expect(validateServerStationMessage({ headline: "http://spam.example" }).ok).toBe(false);
    expect(validateSpecialCopy({ itemName: "Margaritas", price: "$5" }).ok).toBe(true);
  });

  it("builds branded graphic models", () => {
    expect(celebrationBadge("birthday")).toBe("HAPPY BIRTHDAY");
    const model = buildServerStationGraphicModel({
      kind: "birthday",
      headline: "JESSICA!",
      templateId: "neon",
    });
    expect(model.badge).toBe("HAPPY BIRTHDAY");
    expect(model.template.id).toBe("neon");
    expect(model.footer).toContain("FLOBAMA");
  });

  it("resolves tonight expiration after business night end hour", () => {
    const now = new Date("2026-10-17T20:00:00-05:00");
    const ends = resolveServerStationEndsAt({
      preset: "tonight",
      timeZone: "America/Chicago",
      businessNightEndHour: 2,
      now,
    });
    expect(Date.parse(ends)).toBeGreaterThan(now.getTime());
    expect(durationPresetLabel(5)).toBe("5 minutes");
    expect(durationPresetLabel("tonight")).toBe("Tonight only");
  });

  it("detects allowed phone upload kinds", () => {
    expect(detectServerStationUploadKind({ type: "image/jpeg", name: "a.jpg" })).toBe("image");
    expect(detectServerStationUploadKind({ type: "image/webp", name: "a.webp" })).toBe("image");
    expect(detectServerStationUploadKind({ type: "video/mp4", name: "a.mp4" })).toBe("video");
    expect(detectServerStationUploadKind({ type: "application/pdf", name: "a.pdf" })).toBeNull();
  });
});

describe("server override priority", () => {
  it("does not let artist auto cut a live server override", () => {
    expect(
      canAutoArtistCut({
        activeKind: "media",
        activationSource: "server_override",
        activePlaylistId: null,
        defaultPlaylistId: "default",
        activeSceneId: "birthday-1",
      }),
    ).toBe(false);
  });
});

describe("server station wall status copy", () => {
  it("labels local runner and agent links", () => {
    expect(
      wallStatusLabel({
        connected: true,
        link: "local_runner",
        currentlyPlaying: "House Ads",
        offlineReason: null,
        activationSource: null,
        protectedMode: false,
      }),
    ).toBe("Wall Connected · Local Runner");
    expect(
      wallStatusLabel({
        connected: true,
        link: "agent",
        currentlyPlaying: "House Ads",
        offlineReason: null,
        activationSource: null,
        protectedMode: false,
      }),
    ).toBe("Wall Connected");
    expect(
      wallStatusLabel({
        connected: false,
        link: null,
        currentlyPlaying: "House Ads",
        offlineReason: "offline",
        activationSource: null,
        protectedMode: false,
      }),
    ).toBe("Wall Offline");
  });
});

describe("server station artist scene access", () => {
  it("lets servers activate every artist scene without server_approved", () => {
    expect(
      isServerStationActivatableScene({
        enabled: true,
        kind: "media",
        server_approved: false,
        artist_id: "artist-1",
      }),
    ).toBe(true);
    expect(
      isServerStationActivatableScene({
        enabled: true,
        kind: "media",
        server_approved: false,
        artist_id: null,
      }),
    ).toBe(false);
    expect(
      isServerStationActivatableScene({
        enabled: true,
        kind: "media",
        server_approved: true,
        artist_id: null,
      }),
    ).toBe(true);
  });

  it("pages scenes twenty at a time for the POS wall grid", () => {
    const scenes = Array.from({ length: 45 }, (_, index) => ({ id: String(index + 1) }));
    expect(SERVER_STATION_SCENE_PAGE_SIZE).toBe(20);
    const first = paginateServerStationScenes(scenes, 1);
    expect(first.items).toHaveLength(20);
    expect(first.pageCount).toBe(3);
    expect(first.hasPrev).toBe(false);
    expect(first.hasNext).toBe(true);
    const last = paginateServerStationScenes(scenes, 3);
    expect(last.items.map((item) => item.id)).toEqual([
      "41",
      "42",
      "43",
      "44",
      "45",
    ]);
    expect(last.hasNext).toBe(false);
  });
});

describe("server station scene previews", () => {
  it("prefers public_url and falls back to storage path when supabase url is set", () => {
    expect(
      resolveLedScenePreviewUrl({
        public_url: "https://cdn.example/scene.png",
        storage_path: "led/scene.png",
      }),
    ).toBe("https://cdn.example/scene.png");

    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon";
    expect(
      resolveLedScenePreviewUrl({
        public_url: null,
        storage_path: "/led/scene.png",
      }),
    ).toBe("https://project.supabase.co/storage/v1/object/public/screen-ads/led/scene.png");
    process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  });
});

describe("Server Station PWA", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public/server.webmanifest"), "utf8"),
  ) as {
    id: string;
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: Array<{ src: string; sizes: string; purpose: string }>;
  };

  it("uses Server Station branding and standalone launch", () => {
    expect(manifest.name).toBe(SERVER_STATION_PWA_NAME);
    expect(manifest.short_name).toBe(SERVER_STATION_PWA_NAME);
    expect(manifest.id).toBe(SERVER_STATION_HOME_PATH);
    expect(manifest.start_url).toBe(SERVER_STATION_LOGIN_PATH);
    expect(manifest.display).toBe("standalone");
    expect(serverStationPwaMetadata.manifest).toBe(SERVER_STATION_PWA_MANIFEST_PATH);
  });

  it("ships square and maskable icons", () => {
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

  it("does not cache HTML navigations or API traffic in the service worker", () => {
    const source = readFileSync(join(process.cwd(), "public/server-sw.js"), "utf8");
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("text/html");
    expect(source).toContain("/_next/static/");
    expect(source).toContain("/icons/");
  });
});
