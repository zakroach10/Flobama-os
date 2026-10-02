import { describe, expect, it } from "vitest";
import {
  holdMsForLedPlaylistItem,
  isMissingLedPlaylistRelation,
  ledPlaylistIndexAt,
  ledPlaylistsEqual,
  nextLedPlaylistIndex,
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
});
