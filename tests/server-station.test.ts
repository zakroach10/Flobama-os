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
import { canAutoArtistCut } from "@/lib/screens/led-wall-automation";
import { STAFF_ROLES, STAFF_ROLE_LABELS } from "@/lib/constants";

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
