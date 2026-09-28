import { describe, expect, it } from "vitest";
import { authorizeLedWallActivate, authorizeLedWallConfigure } from "@/lib/auth/permissions";
import {
  createLedAgentToken,
  describeAgentLink,
  hashLedAgentToken,
  isAgentStale,
  ledAgentTokensMatch,
  ledMediaKindForFile,
  resolveDesiredObsScene,
  toPublicLedMedia,
} from "@/lib/screens/led-wall";

const now = new Date("2026-09-28T20:00:00.000Z");

describe("LED wall scene resolution", () => {
  it("cuts an enabled OBS scene to its stored name", () => {
    expect(
      resolveDesiredObsScene({
        activeScene: { id: "1", kind: "obs", enabled: true, obsSceneName: "Band" },
        mediaObsSceneName: "Web",
      }),
    ).toBe("Band");
  });

  it("ignores a disabled OBS scene", () => {
    expect(
      resolveDesiredObsScene({
        activeScene: { id: "1", kind: "obs", enabled: false, obsSceneName: "Band" },
        mediaObsSceneName: "Web",
      }),
    ).toBeNull();
  });

  it("cuts a media scene to the admin browser-source scene", () => {
    expect(
      resolveDesiredObsScene({
        activeScene: { id: "2", kind: "media", enabled: true, obsSceneName: null },
        mediaObsSceneName: " FloBama Media ",
      }),
    ).toBe("FloBama Media");
  });

  it("does not invent a scene when media has no browser source", () => {
    expect(
      resolveDesiredObsScene({
        activeScene: { id: "2", kind: "media", enabled: true, obsSceneName: null },
        mediaObsSceneName: "  ",
      }),
    ).toBeNull();
  });

  it("stays idle when nothing is active", () => {
    expect(resolveDesiredObsScene({ activeScene: null, mediaObsSceneName: "Web" })).toBeNull();
  });
});

describe("LED wall public payload", () => {
  it("publishes an mp4 or png and hides other kinds", () => {
    expect(
      toPublicLedMedia({
        scene_id: "scene-1",
        title: " Loop ",
        public_url: "https://cdn.example/loop.mp4",
        media_kind: "video",
      }),
    ).toEqual({
      id: "scene-1",
      title: "Loop",
      url: "https://cdn.example/loop.mp4",
      mediaKind: "video",
    });
    expect(
      toPublicLedMedia({
        scene_id: "scene-2",
        title: "Still",
        public_url: "https://cdn.example/still.png",
        media_kind: "image",
      })?.mediaKind,
    ).toBe("image");
    expect(
      toPublicLedMedia({
        scene_id: "scene-3",
        title: "Week",
        public_url: "dynamic://week_events",
        media_kind: "week_events",
      }),
    ).toBeNull();
    expect(toPublicLedMedia(null)).toBeNull();
  });
});

describe("LED wall booth token", () => {
  it("matches only the issued token", () => {
    const token = createLedAgentToken();
    const hash = hashLedAgentToken(token);
    expect(hash).toHaveLength(64);
    expect(ledAgentTokensMatch(hash, token)).toBe(true);
    expect(ledAgentTokensMatch(hash, `${token}x`)).toBe(false);
    expect(ledAgentTokensMatch("short", token)).toBe(false);
  });
});

describe("LED wall uploads", () => {
  it("accepts mp4 and png only", () => {
    expect(ledMediaKindForFile({ type: "video/mp4", name: "loop.mp4" })).toBe("video");
    expect(ledMediaKindForFile({ type: "image/png", name: "still.png" })).toBe("image");
    expect(ledMediaKindForFile({ type: "image/jpeg", name: "photo.jpg" })).toBeNull();
    expect(ledMediaKindForFile({ type: "video/webm", name: "clip.webm" })).toBeNull();
  });
});

describe("LED wall booth status", () => {
  it("marks a quiet client offline and a fresh one by its OBS program", () => {
    expect(isAgentStale("2026-09-28T19:00:00.000Z", now)).toBe(true);
    expect(
      describeAgentLink({
        lastSeenAt: "2026-09-28T19:59:50.000Z",
        obsConnected: true,
        programScene: "Band",
        now,
      }),
    ).toContain("Program: Band");
    expect(
      describeAgentLink({
        lastSeenAt: null,
        obsConnected: false,
        programScene: null,
        now,
      }),
    ).toBe("Booth client has not checked in yet.");
  });
});

describe("LED wall access", () => {
  it("lets every staff role activate and only admins configure", () => {
    expect(authorizeLedWallActivate("viewer").allowed).toBe(true);
    expect(authorizeLedWallActivate("manager").allowed).toBe(true);
    expect(authorizeLedWallConfigure("viewer").allowed).toBe(false);
    expect(authorizeLedWallConfigure("manager").allowed).toBe(false);
    expect(authorizeLedWallConfigure("admin").allowed).toBe(true);
    expect(authorizeLedWallActivate(null).allowed).toBe(false);
  });
});
