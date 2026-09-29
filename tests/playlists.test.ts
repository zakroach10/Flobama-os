import { describe, expect, it } from "vitest";
import {
  isMissingScreenPlaylistRelation,
  resolvePlaylistItemToPublic,
  specialIsLive,
} from "@/lib/screens/playlists";

describe("screen playlists helpers", () => {
  it("detects missing playlist relation errors", () => {
    expect(isMissingScreenPlaylistRelation('relation "screen_playlists" does not exist')).toBe(true);
    expect(isMissingScreenPlaylistRelation("Could not find the table 'public.menu_specials'")).toBe(true);
    expect(isMissingScreenPlaylistRelation("permission denied")).toBe(false);
  });

  it("maps playlist listing rows to public ads", () => {
    expect(
      resolvePlaylistItemToPublic({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Taco Tuesday",
        public_url: "https://cdn.example.com/taco.jpg",
        media_kind: "image",
        duration_seconds: 12,
        transition: "fade",
      }),
    ).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Taco Tuesday",
      url: "https://cdn.example.com/taco.jpg",
      mediaKind: "image",
      durationSeconds: 12,
      transition: "fade",
    });

    expect(
      resolvePlaylistItemToPublic({
        id: "22222222-2222-4222-8222-222222222222",
        title: "This week's events",
        public_url: "dynamic://week_events",
        media_kind: "image",
        duration_seconds: 20,
        transition: "cut",
      }).mediaKind,
    ).toBe("week_events");
  });

  it("filters specials by enablement and schedule window", () => {
    const now = new Date("2026-09-29T18:00:00.000Z");
    expect(
      specialIsLive(
        {
          enabled: true,
          archived_at: null,
          starts_at: "2026-09-29T12:00:00.000Z",
          ends_at: "2026-09-30T04:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      specialIsLive(
        {
          enabled: true,
          archived_at: null,
          starts_at: "2026-09-30T12:00:00.000Z",
          ends_at: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      specialIsLive(
        {
          enabled: false,
          archived_at: null,
          starts_at: null,
          ends_at: null,
        },
        now,
      ),
    ).toBe(false);
  });
});
