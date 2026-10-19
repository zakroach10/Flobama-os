import { describe, expect, it } from "vitest";
import { ledMenuPreviewUrl } from "@/lib/screens/led-video-poster";

describe("ledMenuPreviewUrl", () => {
  it("requires a poster for video loops", () => {
    expect(
      ledMenuPreviewUrl({
        media_kind: "video",
        public_url: "https://cdn.example/loop.mp4",
        poster_url: "https://cdn.example/loop-poster.png",
      }),
    ).toBe("https://cdn.example/loop-poster.png");

    expect(
      ledMenuPreviewUrl({
        media_kind: "video",
        public_url: "https://cdn.example/loop.mp4",
        poster_url: null,
      }),
    ).toBeNull();
  });

  it("uses the image URL for still logos", () => {
    expect(
      ledMenuPreviewUrl({
        media_kind: "image",
        public_url: "https://cdn.example/logo.png",
        poster_url: null,
      }),
    ).toBe("https://cdn.example/logo.png");
  });
});
