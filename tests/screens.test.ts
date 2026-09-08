import { describe, expect, it } from "vitest";
import { DEMO_VERTICAL_ADS, DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import { holdMsForAd, nextPlaylistIndex, playlistsEqual, toPublicPlaylist, type StaffScreenAd } from "@/lib/screens/playlist";
import { buildWeekSlidePayload, paginateWeekDays } from "@/lib/screens/week";
import { liveFromNowPayload, resolveWallScene, shouldUseBandScene } from "@/lib/screens/wall";
import { mediaKindForFile, MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";
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

  it("ships a local fixture that includes the weekly events slide", () => {
    expect(DEMO_VERTICAL_ADS).toHaveLength(3);
    expect(DEMO_VERTICAL_ADS[2]?.mediaKind).toBe("week_events");
    expect(DEMO_WEEK_SLIDE.eventCount).toBe(3);
    expect(holdMsForAd(DEMO_VERTICAL_ADS[0]!)).toBe(4000);
  });

  it("keeps a week slide in the public playlist", () => {
    const playlist = toPublicPlaylist([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "This week's events",
        public_url: "dynamic://week_events",
        media_kind: "week_events",
        duration_seconds: 20,
        transition: "fade",
        sort_order: 0,
        enabled: true,
        archived_at: null,
      },
    ]);
    expect(playlist[0]?.mediaKind).toBe("week_events");
    expect(playlist[0]?.url).toBe("dynamic://week_events");
  });

  it("advances the playlist without resetting when contents are unchanged", () => {
    expect(nextPlaylistIndex(0, 3)).toBe(1);
    expect(nextPlaylistIndex(2, 3)).toBe(0);
    const first = toPublicPlaylist([sample[2]]);
    const second = toPublicPlaylist([sample[2]]);
    expect(playlistsEqual(first, second)).toBe(true);
    expect(playlistsEqual(first, [{ ...first[0]!, durationSeconds: 99 }])).toBe(false);
  });

  it("classifies stills and videos and rejects oversized ads", () => {
    expect(mediaKindForFile({ type: "image/png", name: "happy.png" })).toBe("image");
    expect(mediaKindForFile({ type: "video/mp4", name: "spot.mp4" })).toBe("video");
    expect(mediaKindForFile({ type: "application/pdf", name: "menu.pdf" })).toBeNull();
    expect(MAX_SCREEN_AD_BYTES).toBe(50 * 1024 * 1024);
  });

  it("requires a hold time for the week slide", () => {
    expect(
      screenAdMetaSchema.safeParse({
        title: "This week's events",
        durationSeconds: null,
        transition: "fade",
        enabled: true,
        mediaKind: "week_events",
      }).success,
    ).toBe(false);
  });
});

describe("this week slide", () => {
  it("groups public events by venue-local day", () => {
    const payload = buildWeekSlidePayload(
      [
        {
          id: "a",
          name: "Tuesday band",
          day: "Tuesday",
          date: "Sep 8, 2026",
          time: "7:00 PM",
          display: "Tue, Sep 8 • 7:00 PM",
          ticketed: false,
          ticketUrl: null,
          coverCharge: null,
          startsAt: "2026-09-09T00:00:00.000Z",
          endsAt: "2026-09-09T03:00:00.000Z",
          eventType: "live_music",
          locationLabel: null,
          featured: false,
          artists: ["Tuesday band"],
        },
        {
          id: "b",
          name: "Late set",
          day: "Tuesday",
          date: "Sep 8, 2026",
          time: "10:30 PM",
          display: "Tue, Sep 8 • 10:30 PM",
          ticketed: false,
          ticketUrl: null,
          coverCharge: "$5",
          startsAt: "2026-09-09T03:30:00.000Z",
          endsAt: "2026-09-09T05:30:00.000Z",
          eventType: "live_music",
          locationLabel: null,
          featured: false,
          artists: [],
        },
      ],
      new Date("2026-09-08T22:00:00.000Z"),
    );
    expect(payload.rangeLabel).toBe("Sep 6–12, 2026");
    expect(payload.days).toHaveLength(1);
    expect(payload.days[0]?.events.map((event) => event.name)).toEqual(["Tuesday band", "Late set"]);
    expect(payload.days[0]?.dateKey).toBe("2026-09-08");
  });

  it("paginates a busy week without dropping days", () => {
    const days = Array.from({ length: 7 }, (_, index) => ({
      dateKey: `2026-09-0${index + 6}`,
      weekday: "Day",
      dateLabel: `Sep ${index + 6}`,
      events: [
        {
          id: `${index}-a`,
          name: "Early",
          time: "7:00 PM",
          artists: [],
          ticketed: false,
          coverCharge: null,
          featured: false,
        },
        {
          id: `${index}-b`,
          name: "Late",
          time: "10:00 PM",
          artists: [],
          ticketed: false,
          coverCharge: null,
          featured: false,
        },
      ],
    }));
    const pages = paginateWeekDays(days, 8);
    expect(pages.flat().flatMap((day) => day.events)).toHaveLength(14);
    expect(pages.length).toBeGreaterThan(1);
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
