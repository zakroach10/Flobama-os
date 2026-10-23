import { describe, expect, it } from "vitest";
import { collectArtistsMissingLogos } from "@/lib/queries/dashboard";
import type { EventRow } from "@/lib/queries/events";

function event(partial: {
  id: string;
  title: string;
  starts_at: string;
  artists: Array<{ id: string; name: string; archived_at?: string | null }>;
}): EventRow {
  return {
    id: partial.id,
    title: partial.title,
    starts_at: partial.starts_at,
    ends_at: partial.starts_at,
    event_artists: partial.artists.map((artist, index) => ({
      artist_id: artist.id,
      display_order: index,
      artists: {
        id: artist.id,
        name: artist.name,
        archived_at: artist.archived_at ?? null,
      },
    })),
  } as EventRow;
}

const WEEK_END = "2026-10-26T05:00:00.000Z";

describe("collectArtistsMissingLogos", () => {
  it("keeps this-week artists before upcoming and skips logos already on file", () => {
    const rows = collectArtistsMissingLogos(
      [
        event({
          id: "e-upcoming",
          title: "Saturday night",
          starts_at: "2026-10-31T01:00:00.000Z",
          artists: [{ id: "a-late", name: "Late Band" }],
        }),
        event({
          id: "e-week",
          title: "Friday night",
          starts_at: "2026-10-24T01:00:00.000Z",
          artists: [
            { id: "a-missing", name: "Missing Band" },
            { id: "a-ready", name: "Ready Band" },
          ],
        }),
      ],
      new Set(["a-ready"]),
      WEEK_END,
    );

    expect(rows.map((row) => row.artistId)).toEqual(["a-missing", "a-late"]);
    expect(rows[0]).toMatchObject({
      bucket: "this_week",
      eventTitle: "Friday night",
      artistName: "Missing Band",
    });
    expect(rows[1]).toMatchObject({
      bucket: "upcoming",
      eventTitle: "Saturday night",
    });
  });

  it("dedupes to the soonest show and ignores archived artists", () => {
    const rows = collectArtistsMissingLogos(
      [
        event({
          id: "e-later",
          title: "Later set",
          starts_at: "2026-10-25T03:00:00.000Z",
          artists: [{ id: "a-1", name: "Twice Booked" }],
        }),
        event({
          id: "e-sooner",
          title: "Sooner set",
          starts_at: "2026-10-24T01:00:00.000Z",
          artists: [
            { id: "a-1", name: "Twice Booked" },
            { id: "a-old", name: "Archived Act", archived_at: "2026-01-01T00:00:00.000Z" },
          ],
        }),
      ],
      new Set(),
      WEEK_END,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      artistId: "a-1",
      eventId: "e-sooner",
      eventTitle: "Sooner set",
      bucket: "this_week",
    });
  });
});
