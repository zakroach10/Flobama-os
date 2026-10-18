import { describe, expect, it } from "vitest";
import {
  cursorAfterPlaylistEdit,
  holdMsForLedPlaylistItem,
  insertionAfterCurrentAd,
  isMissingLedPlaylistRelation,
  ledPlaylistIndexAt,
  ledPlaylistPosition,
  ledPlaylistsEqual,
  nextLedPlaylistIndex,
  nextLedPlaylistMediaItem,
  preserveLedPlaylistStartedAt,
  resolveLedPlaylistStartedAt,
  type PublicLedPlaylistItem,
} from "@/lib/screens/led-playlists";

describe("LED wall playlists", () => {
  it("detects missing playlist relations", () => {
    expect(isMissingLedPlaylistRelation('relation "led_wall_playlists" does not exist')).toBe(true);
    expect(isMissingLedPlaylistRelation("permission denied for table led_wall_scenes")).toBe(false);
  });

  it("advances playlist indexes", () => {
    expect(nextLedPlaylistIndex(0, 3)).toBe(1);
    expect(nextLedPlaylistIndex(2, 3)).toBe(0);
    expect(nextLedPlaylistIndex(0, 0)).toBe(0);
  });

  it("holds images by duration and videos until ended", () => {
    expect(holdMsForLedPlaylistItem({ kind: "media", mediaKind: "image", durationSeconds: 12 })).toBe(12_000);
    expect(holdMsForLedPlaylistItem({ kind: "media", mediaKind: "video", durationSeconds: 12 })).toBe(0);
    expect(holdMsForLedPlaylistItem({ kind: "obs", mediaKind: null, durationSeconds: 20 })).toBe(20_000);
  });

  it("picks the time-based playlist slot", () => {
    const items = [{ durationSeconds: 10 }, { durationSeconds: 20 }, { durationSeconds: 10 }];
    const startedAt = "2026-09-29T16:00:00.000Z";
    expect(ledPlaylistIndexAt(items, startedAt, Date.parse("2026-09-29T16:00:05.000Z"))).toBe(0);
    expect(ledPlaylistIndexAt(items, startedAt, Date.parse("2026-09-29T16:00:15.000Z"))).toBe(1);
    expect(ledPlaylistIndexAt(items, startedAt, Date.parse("2026-09-29T16:00:35.000Z"))).toBe(2);
    expect(ledPlaylistIndexAt(items, startedAt, Date.parse("2026-09-29T16:00:45.000Z"))).toBe(0);
  });

  it("compares playlist payloads without rewriting identical polls", () => {
    const item: PublicLedPlaylistItem = {
      id: "1",
      sceneId: "s1",
      title: "Still",
      kind: "media",
      mediaKind: "image",
      url: "https://cdn.example/a.png",
      obsSceneName: null,
      durationSeconds: 15,
    };
    expect(ledPlaylistsEqual([item], [{ ...item }])).toBe(true);
    expect(ledPlaylistsEqual([item], [{ ...item, durationSeconds: 20 }])).toBe(false);
  });

  it("finds the next media item for preload, skipping OBS slots", () => {
    const imageA: PublicLedPlaylistItem = {
      id: "a",
      sceneId: "sa",
      title: "A",
      kind: "media",
      mediaKind: "image",
      url: "https://cdn.example/a.png",
      obsSceneName: null,
      durationSeconds: 10,
    };
    const obs: PublicLedPlaylistItem = {
      id: "obs",
      sceneId: "so",
      title: "Cam",
      kind: "obs",
      mediaKind: null,
      url: null,
      obsSceneName: "Cam 1",
      durationSeconds: 20,
    };
    const videoB: PublicLedPlaylistItem = {
      id: "b",
      sceneId: "sb",
      title: "B",
      kind: "media",
      mediaKind: "video",
      url: "https://cdn.example/b.mp4",
      obsSceneName: null,
      durationSeconds: 15,
    };
    const items = [imageA, obs, videoB];
    expect(nextLedPlaylistMediaItem(items, 0)?.id).toBe("b");
    expect(nextLedPlaylistMediaItem(items, 1)?.id).toBe("b");
    expect(nextLedPlaylistMediaItem(items, 2)?.id).toBe("a");
    expect(nextLedPlaylistMediaItem([imageA], 0)).toBeNull();
    expect(nextLedPlaylistMediaItem([imageA, obs], 0)).toBeNull();
  });

  it("keeps the current ad when a slide is added after the roll has looped", () => {
    const startedAt = "2026-09-29T16:00:00.000Z";
    const before = [
      { id: "a", durationSeconds: 10 },
      { id: "b", durationSeconds: 10 },
      { id: "c", durationSeconds: 20 },
    ];
    const now = Date.parse(startedAt) + 7210 * 1000;
    expect(ledPlaylistIndexAt(before, startedAt, now)).toBe(1);
    expect(ledPlaylistPosition(before, startedAt, now).elapsedSeconds).toBe(0);

    const after = [...before, { id: "d", durationSeconds: 15 }];
    // The longer cycle maps the same clock onto a different ad.
    expect(ledPlaylistIndexAt(after, startedAt, now)).not.toBe(1);

    const preserved = preserveLedPlaylistStartedAt(before, startedAt, after, now);
    expect(preserved).toBeTruthy();
    expect(ledPlaylistIndexAt(after, preserved, now)).toBe(1);
    expect(after[ledPlaylistIndexAt(after, preserved, now)]?.id).toBe("b");
    expect(ledPlaylistPosition(after, preserved, now).remainingSeconds).toBeGreaterThan(9);

    const resolved = resolveLedPlaylistStartedAt(before, startedAt, after, startedAt, now);
    expect(after[ledPlaylistIndexAt(after, resolved, now)]?.id).toBe("b");
  });

  it("starts the following ad from the beginning when the on-screen slide is removed", () => {
    const startedAt = "2026-09-29T16:00:00.000Z";
    const before = [
      { id: "a", durationSeconds: 10 },
      { id: "b", durationSeconds: 10 },
      { id: "c", durationSeconds: 10 },
    ];
    const now = Date.parse(startedAt) + 12_000;
    expect(before[ledPlaylistIndexAt(before, startedAt, now)]?.id).toBe("b");
    const after = [before[0], before[2]];
    const nextClock = cursorAfterPlaylistEdit(before, startedAt, after, now);
    expect(nextClock).toBeTruthy();
    expect(after[ledPlaylistIndexAt(after, nextClock, now)]?.id).toBe("c");
    expect(ledPlaylistPosition(after, nextClock, now).elapsedSeconds).toBeLessThan(0.1);
  });

  it("still honors a fresh playlist activation", () => {
    const previous = [{ id: "a", durationSeconds: 10 }];
    const now = Date.parse("2026-10-18T18:00:00.000Z");
    const fresh = new Date(now).toISOString();
    const resolved = resolveLedPlaylistStartedAt(previous, "2026-10-18T12:00:00.000Z", previous, fresh, now);
    expect(resolved).toBe(fresh);
  });

  it("slots a new server slide immediately after the ad on screen", () => {
    const startedAt = "2026-09-29T16:00:00.000Z";
    const items = [
      { id: "a", sortOrder: 0, durationSeconds: 10 },
      { id: "b", sortOrder: 1, durationSeconds: 10 },
      { id: "c", sortOrder: 2, durationSeconds: 10 },
    ];
    const now = Date.parse(startedAt) + 12_000;
    expect(insertionAfterCurrentAd(items, startedAt, now)).toEqual({
      sortOrder: 2,
      shiftAfterSortOrder: 1,
    });
    const onLast = Date.parse(startedAt) + 25_000;
    expect(insertionAfterCurrentAd(items, startedAt, onLast)).toEqual({
      sortOrder: 3,
      shiftAfterSortOrder: null,
    });
  });
});
