import { describe, expect, it } from "vitest";
import { DEMO_VERTICAL_ADS } from "@/lib/screens/demo";
import { holdMsForAd, toPublicPlaylist, type StaffScreenAd } from "@/lib/screens/playlist";
import { liveFromNowPayload, resolveWallScene, shouldUseBandScene } from "@/lib/screens/wall";
import { screenAdMetaSchema } from "@/lib/validation/schemas";

const sample: StaffScreenAd[] = [
  {
    id: "1",
    title: "Draft still",
    public_url: "https://example.com/a.jpg",
    media_kind: "image",
    duration_seconds: 8,
    transition: "fade",
    sort_order: 1,
    enabled: false,
    archived_at: null,
  },
  {
    id: "2",
    title: "Old still",
    public_url: "https://example.com/b.jpg",
    media_kind: "image",
    duration_seconds: 8,
    transition: "cut",
    sort_order: 0,
    enabled: true,
    archived_at: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "3",
    title: "Live still",
    public_url: "https://example.com/c.jpg",
    media_kind: "image",
    duration_seconds: 12,
    transition: "slide",
    sort_order: 2,
    enabled: true,
    archived_at: null,
  },
];

describe("vertical playlist", () => {
  it("drops disabled and archived ads and sorts the rest", () => {
    const playlist = toPublicPlaylist(sample);
    expect(playlist).toHaveLength(1);
    expect(playlist[0]?.id).toBe("3");
    expect(playlist[0]?.url).toBe("https://example.com/c.jpg");
    expect(JSON.stringify(playlist)).not.toMatch(/archived/i);
    expect(JSON.stringify(playlist)).not.toMatch(/enabled/i);
  });

  it("uses image hold time and treats uncapped video as player-driven", () => {
    expect(holdMsForAd({ ...toPublicPlaylist([sample[2]])[0] })).toBe(12000);
    expect(
      holdMsForAd({
        id: "v",
        title: "Spot",
        url: "https://example.com/v.mp4",
        mediaKind: "video",
        durationSeconds: null,
        transition: "fade",
      }),
    ).toBe(0);
  });

  it("rejects invalid durations and transitions", () => {
    expect(screenAdMetaSchema.safeParse({ title: "X", durationSeconds: 0, transition: "fade", enabled: true }).success).toBe(
      false,
    );
    expect(
      screenAdMetaSchema.safeParse({ title: "X", durationSeconds: 10, transition: "wipe", enabled: true }).success,
    ).toBe(false);
    expect(
      screenAdMetaSchema.safeParse({ title: "Happy Hour", durationSeconds: 10, transition: "slide", enabled: true }).success,
    ).toBe(true);
    expect(
      screenAdMetaSchema.safeParse({
        title: "Still",
        durationSeconds: null,
        transition: "fade",
        enabled: true,
        mediaKind: "image",
      }).success,
    ).toBe(false);
    expect(
      screenAdMetaSchema.safeParse({
        title: "Spot",
        durationSeconds: null,
        transition: "cut",
        enabled: true,
        mediaKind: "video",
      }).success,
    ).toBe(true);
  });

  it("ships a two-slide local fixture for the vertical player", () => {
    expect(DEMO_VERTICAL_ADS).toHaveLength(2);
    expect(DEMO_VERTICAL_ADS.every((ad) => ad.url.startsWith("data:image/svg+xml"))).toBe(true);
    expect(holdMsForAd(DEMO_VERTICAL_ADS[0]!)).toBe(4000);
  });
});

describe("LED wall auto rule", () => {
  const wall = {
    mode: "auto" as const,
    adsSceneName: "Ads",
    bandSceneName: "Band Logo",
    manualSceneName: "Stinger",
  };

  it("uses the band scene when now-playing or a public event overlaps", () => {
    expect(shouldUseBandScene({ nowPlaying: true, overlappingPublicEvent: false })).toBe(true);
    expect(shouldUseBandScene({ nowPlaying: false, overlappingPublicEvent: true })).toBe(true);
    expect(resolveWallScene(wall, { nowPlaying: false, overlappingPublicEvent: false })).toBe("Ads");
    expect(resolveWallScene(wall, { nowPlaying: true, overlappingPublicEvent: false })).toBe("Band Logo");
  });

  it("uses the manual scene only in manual mode", () => {
    expect(
      resolveWallScene({ ...wall, mode: "manual" }, { nowPlaying: true, overlappingPublicEvent: true }),
    ).toBe("Stinger");
  });

  it("reads band vs ads from the public now payload", () => {
    const now = "2026-09-08T22:00:00.000Z";
    expect(
      liveFromNowPayload(
        {
          nowPlaying: null,
          today: [{ startsAt: "2026-09-08T21:00:00.000Z", endsAt: "2026-09-08T23:00:00.000Z" }],
        },
        now,
      ),
    ).toEqual({ nowPlaying: false, overlappingPublicEvent: true });
    expect(
      liveFromNowPayload({ nowPlaying: { id: "evt" }, today: [] }, now),
    ).toEqual({ nowPlaying: true, overlappingPublicEvent: false });
  });
});
