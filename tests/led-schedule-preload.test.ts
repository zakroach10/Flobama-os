import { describe, expect, it } from "vitest";
import type { TodayLedListing } from "@/lib/queries/artist-led";
import {
  mergeLedWarmupAssetIds,
  scheduledLedWarmupSceneIds,
} from "@/lib/screens/led-schedule-preload";

function listing(
  partial: Partial<TodayLedListing> & Pick<TodayLedListing, "eventId" | "artists">,
): TodayLedListing {
  return {
    title: "Show",
    startsAt: "2026-10-23T01:00:00.000Z",
    endsAt: "2026-10-23T04:00:00.000Z",
    status: "published",
    artistNames: partial.artists.map((artist) => artist.name),
    ...partial,
  };
}

describe("scheduledLedWarmupSceneIds", () => {
  it("collects enabled artist scene ids from today's schedule", () => {
    const ids = scheduledLedWarmupSceneIds([
      listing({
        eventId: "e1",
        artists: [
          {
            artistId: "a1",
            name: "Band A",
            displayOrder: 0,
            sceneId: "scene-a",
            publicUrl: "https://cdn.example/a.png",
            enabled: true,
          },
          {
            artistId: "a2",
            name: "Band B",
            displayOrder: 1,
            sceneId: null,
            publicUrl: null,
            enabled: false,
          },
        ],
      }),
      listing({
        eventId: "e2",
        artists: [
          {
            artistId: "a3",
            name: "Band C",
            displayOrder: 0,
            sceneId: "scene-c",
            publicUrl: "https://cdn.example/c.mp4",
            enabled: true,
          },
        ],
      }),
    ]);
    expect(ids).toEqual(["scene-a", "scene-c"]);
  });

  it("dedupes the same scene across multiple events", () => {
    const ids = scheduledLedWarmupSceneIds([
      listing({
        eventId: "e1",
        artists: [
          {
            artistId: "a1",
            name: "Band A",
            displayOrder: 0,
            sceneId: "shared",
            publicUrl: "https://cdn.example/a.png",
            enabled: true,
          },
        ],
      }),
      listing({
        eventId: "e2",
        artists: [
          {
            artistId: "a1",
            name: "Band A",
            displayOrder: 0,
            sceneId: "shared",
            publicUrl: "https://cdn.example/a.png",
            enabled: true,
          },
        ],
      }),
    ]);
    expect(ids).toEqual(["shared"]);
  });
});

describe("mergeLedWarmupAssetIds", () => {
  it("keeps active playback first and appends new warmup ids", () => {
    expect(mergeLedWarmupAssetIds(["playing", "next"], ["warmup", "playing", "extra"])).toEqual([
      "playing",
      "next",
      "warmup",
      "extra",
    ]);
  });

  it("ignores blank warmup ids", () => {
    expect(mergeLedWarmupAssetIds(["a"], ["", "b"])).toEqual(["a", "b"]);
  });
});
