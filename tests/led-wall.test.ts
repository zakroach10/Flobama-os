import { describe, expect, it } from "vitest";
import { authorizeLedWallActivate, authorizeLedWallConfigure } from "@/lib/auth/permissions";
import { restartLedVideo, samePublicLedMedia, videoNearsEnd } from "@/lib/screens/led-loop";
import {
  createLedAgentToken,
  describeAgentLink,
  hashLedAgentToken,
  isAgentStale,
  ledAgentTokensMatch,
  ledMediaKindForFile,
  resolveDesiredObsScene,
  resolveShowtimeHandoff,
  artistsMissingLedConfiguration,
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

describe("LED wall showtime", () => {
  const adRoll = { id: "ads", enabled: true, rollsUntilShowtime: true };
  const headliner = { id: "band", enabled: true };
  const showStartsAt = new Date("2026-09-28T20:00:00.000Z");

  it("keeps the ad roll up before showtime", () => {
    expect(
      resolveShowtimeHandoff({
        now: new Date("2026-09-28T19:59:00.000Z"),
        active: adRoll,
        showStartsAt,
        headliner,
      }),
    ).toEqual({ sceneId: "ads", advanceTo: null });
  });

  it("cuts to the first artist at showtime", () => {
    expect(
      resolveShowtimeHandoff({
        now: showStartsAt,
        active: adRoll,
        showStartsAt,
        headliner,
      }),
    ).toEqual({ sceneId: "band", advanceTo: "band" });
  });

  it("leaves the ad roll up when the first artist has no configuration", () => {
    expect(
      resolveShowtimeHandoff({
        now: showStartsAt,
        active: adRoll,
        showStartsAt,
        headliner: null,
      }),
    ).toEqual({ sceneId: "ads", advanceTo: null });
    expect(
      resolveShowtimeHandoff({
        now: showStartsAt,
        active: adRoll,
        showStartsAt: null,
        headliner,
      }),
    ).toEqual({ sceneId: "ads", advanceTo: null });
  });

  it("leaves any other active card alone", () => {
    expect(
      resolveShowtimeHandoff({
        now: showStartsAt,
        active: { id: "still", enabled: true, rollsUntilShowtime: false },
        showStartsAt,
        headliner,
      }),
    ).toEqual({ sceneId: "still", advanceTo: null });
  });
});

describe("LED wall missing artist configurations", () => {
  const now = new Date("2026-09-28T18:00:00.000Z");
  const event = {
    status: "published",
    ends_at: "2026-09-28T23:00:00.000Z",
    archived_at: null,
    event_artists: [
      { display_order: 1, artists: { name: "Opener", archived_at: null, led_wall_scene_id: null } },
      { display_order: 0, artists: { name: "Headliner", archived_at: null, led_wall_scene_id: "band" } },
    ],
  };

  it("names the attached artists who are not ready", () => {
    expect(artistsMissingLedConfiguration(event, now)).toEqual(["Opener"]);
  });

  it("stays quiet for a ready bill, a show with no artists, a past show, and a cancelled show", () => {
    expect(
      artistsMissingLedConfiguration(
        {
          ...event,
          event_artists: [{ display_order: 0, artists: { name: "Headliner", archived_at: null, led_wall_scene_id: "band" } }],
        },
        now,
      ),
    ).toEqual([]);
    expect(artistsMissingLedConfiguration({ ...event, event_artists: [] }, now)).toEqual([]);
    expect(artistsMissingLedConfiguration({ ...event, ends_at: "2026-09-28T17:00:00.000Z" }, now)).toEqual([]);
    expect(artistsMissingLedConfiguration({ ...event, status: "cancelled" }, now)).toEqual([]);
  });
});

describe("LED ad roll looping", () => {
  const clip = { id: "ads", title: "Roll", url: "https://example.com/roll.mp4", mediaKind: "video" as const };

  it("wraps near the end and ignores the opening frames", () => {
    expect(videoNearsEnd(9.8, 10)).toBe(true);
    expect(videoNearsEnd(9.6, 10)).toBe(false);
    expect(videoNearsEnd(0.1, 10)).toBe(false);
    expect(videoNearsEnd(Number.NaN, 10)).toBe(false);
    expect(videoNearsEnd(0.2, 0.22)).toBe(false);
  });

  it("keeps the same clip when a poll repeats it", () => {
    expect(samePublicLedMedia(clip, { ...clip })).toBe(true);
    expect(samePublicLedMedia(clip, { ...clip, url: "https://example.com/other.mp4" })).toBe(false);
    expect(samePublicLedMedia(clip, null)).toBe(false);
    expect(samePublicLedMedia(null, null)).toBe(true);
  });

  it("seeks to the start when the file can be seeked", () => {
    const video = fakeVideo();
    restartLedVideo(video);
    expect(video.currentTime).toBe(0);
    expect(video.played).toBe(1);
    expect(video.loaded).toBe(0);
    expect(video.loop).toBe(true);
  });

  it("reloads when the file cannot seek back to the start", () => {
    const unseekable = fakeVideo({ seekableLength: 0 });
    restartLedVideo(unseekable);
    expect(unseekable.loaded).toBe(1);
    expect(unseekable.played).toBe(1);
    expect(unseekable.currentTime).toBe(0);

    const stuck = fakeVideo({ ignoreRewind: true });
    restartLedVideo(stuck);
    expect(stuck.loaded).toBe(1);
    expect(stuck.played).toBe(1);
    expect(stuck.currentTime).toBe(0);
  });
});

function fakeVideo(options?: { ignoreRewind?: boolean; seekableLength?: number }) {
  let time = 11.9;
  const listeners: Array<() => void> = [];
  return {
    duration: 12,
    seekable: { length: options?.seekableLength ?? 1 },
    loop: false,
    played: 0,
    loaded: 0,
    get currentTime() {
      return time;
    },
    set currentTime(value: number) {
      if (options?.ignoreRewind && value === 0) return;
      time = value;
    },
    load() {
      this.loaded += 1;
      time = 0;
    },
    play() {
      this.played += 1;
      return Promise.resolve();
    },
    addEventListener(_type: "loadeddata", listener: () => void) {
      listeners.push(listener);
      listener();
    },
    removeEventListener() {},
  };
}
