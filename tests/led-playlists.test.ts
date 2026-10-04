import { describe, expect, it } from "vitest";
import {
  holdMsForLedPlaylistItem,
  isMissingLedPlaylistRelation,
  ledPlaylistIndexAt,
  ledPlaylistsEqual,
  nextLedPlaylistIndex,
  nextLedPlaylistMediaItem,
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
});
