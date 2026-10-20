import { describe, expect, it } from "vitest";
import {
  parseYoutubeVideoUrl,
  youtubeEmbedUrl,
  youtubeStoragePath,
  youtubeWallEndsAt,
  youtubeWatchUrl,
} from "@/lib/screens/youtube";
import { toPublicLedMedia } from "@/lib/screens/led-wall";

describe("YouTube wall URL parsing", () => {
  it("parses watch, short, and embed links", () => {
    expect(parseYoutubeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoUrl("youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-video links", () => {
    expect(parseYoutubeVideoUrl("https://www.youtube.com/@flobamamusichall")).toBeNull();
    expect(parseYoutubeVideoUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYoutubeVideoUrl("not a url")).toBeNull();
    expect(parseYoutubeVideoUrl("")).toBeNull();
  });

  it("builds canonical watch/embed/storage paths", () => {
    const parsed = parseYoutubeVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(parsed?.watchUrl).toBe(youtubeWatchUrl("dQw4w9WgXcQ"));
    expect(parsed?.embedUrl).toBe(youtubeEmbedUrl("dQw4w9WgXcQ"));
    expect(parsed?.storagePath).toBe(youtubeStoragePath("dQw4w9WgXcQ"));
  });

  it("sets a multi-hour safety end time", () => {
    const now = new Date("2026-10-20T19:00:00.000Z");
    const ends = Date.parse(youtubeWallEndsAt(now));
    expect(ends - now.getTime()).toBe(4 * 60 * 60 * 1000);
  });
});

describe("YouTube public LED media", () => {
  it("publishes youtube media_kind to the wall player", () => {
    expect(
      toPublicLedMedia({
        scene_id: "scene-yt",
        title: " Guest clip ",
        public_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        media_kind: "youtube",
      }),
    ).toEqual({
      id: "scene-yt",
      title: "Guest clip",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      mediaKind: "youtube",
    });
  });
});
