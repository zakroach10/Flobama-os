import { describe, expect, it } from "vitest";
import {
  artistMatchKey,
  artistNamesEquivalent,
  findArtistIdByName,
  normalizeArtistName,
} from "@/lib/artists/names";

describe("artist name normalization", () => {
  it("treats Band suffix / The prefix variants as the same artist", () => {
    expect(normalizeArtistName("Foo")).toBe("foo");
    expect(normalizeArtistName("Foo Band")).toBe("foo");
    expect(normalizeArtistName("The Foo Band")).toBe("foo");
    expect(normalizeArtistName("  FOO   BAND  ")).toBe("foo");
    expect(artistNamesEquivalent("Midnight Riders", "The Midnight Riders Band")).toBe(true);
  });

  it("keeps distinct band names apart", () => {
    expect(artistNamesEquivalent("Foo", "Bar")).toBe(false);
    expect(artistNamesEquivalent("Foo Band", "Foo Bars")).toBe(false);
  });

  it("matches The Band / Band after stripping the leading The", () => {
    expect(normalizeArtistName("The Band")).toBe("band");
    expect(artistMatchKey("The Band")).toBe("band");
    expect(artistMatchKey("Band")).toBe("band");
    expect(artistNamesEquivalent("The Band", "Band")).toBe(true);
  });

  it("prefers exact name match before fuzzy match", () => {
    const artists = [
      { id: "1", name: "Foo" },
      { id: "2", name: "Foo Band" },
    ];
    expect(findArtistIdByName(artists, "Foo Band")).toBe("2");
    expect(findArtistIdByName(artists, "The Foo Band")).toBe("1");
  });
});
