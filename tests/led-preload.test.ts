import { describe, expect, it } from "vitest";
import { LED_DISPLAY_POLL_MS } from "@/lib/constants";
import {
  LED_PRELOAD_LEAD_MS,
  LED_PRELOAD_MAX_IMAGES,
  capPreloadItems,
  commandToVisibleMs,
  mergePreloadItems,
  playlistPreloadItems,
  scheduledPreloadItems,
  summarizePreloadReports,
  visibleWhileLoading,
  type PreloadItem,
} from "@/lib/screens/led-preload";

const logo = (id: string, kind: "image" | "video" = "image"): PreloadItem => ({
  id,
  title: id,
  url: `https://cdn.example/${id}.png`,
  mediaKind: kind,
  source: "schedule",
  startsAt: "2026-11-06T20:00:00.000Z",
});

describe("scheduled LED preload", () => {
  const now = Date.parse("2026-11-06T19:50:00.000Z");
  const listings = [
    {
      startsAt: "2026-11-06T20:00:00.000Z",
      endsAt: "2026-11-06T21:00:00.000Z",
      artists: [
        {
          name: "The House Band",
          enabled: true,
          sceneId: "scene-1",
          scenes: [
            {
              sceneId: "scene-1",
              title: "House logo",
              publicUrl: "https://cdn.example/house.png",
              mediaKind: "image",
              enabled: true,
            },
          ],
        },
      ],
    },
    {
      startsAt: "2026-11-06T22:00:00.000Z",
      endsAt: "2026-11-06T23:00:00.000Z",
      artists: [
        {
          name: "Late Set",
          enabled: true,
          sceneId: "scene-late",
          scenes: [
            {
              sceneId: "scene-late",
              title: "Late",
              publicUrl: "https://cdn.example/late.png",
              mediaKind: "image",
              enabled: true,
            },
          ],
        },
      ],
    },
  ];

  it("warms a show inside the lead and skips one that is still later", () => {
    const items = scheduledPreloadItems(listings, now, LED_PRELOAD_LEAD_MS);
    expect(items.map((item) => item.id)).toEqual(["scene-1"]);
    expect(LED_PRELOAD_LEAD_MS).toBe(20 * 60 * 1000);
  });

  it("does not warm a show that already ended", () => {
    const items = scheduledPreloadItems(listings, Date.parse("2026-11-06T21:05:00.000Z"), LED_PRELOAD_LEAD_MS);
    expect(items).toEqual([]);
  });
});

describe("preload limits and the live frame", () => {
  it("caps images and videos and drops the url already on the wall", () => {
    const scheduled = Array.from({ length: 8 }, (_, index) => logo(`img-${index}`));
    const manual = [logo("vid-1", "video"), logo("vid-2", "video"), logo("vid-3", "video")];
    const merged = mergePreloadItems({
      scheduled,
      manual,
      activeUrl: scheduled[0]?.url,
    });
    expect(merged.filter((item) => item.mediaKind === "image")).toHaveLength(LED_PRELOAD_MAX_IMAGES);
    expect(merged.filter((item) => item.mediaKind === "video")).toHaveLength(2);
    expect(merged.some((item) => item.url === scheduled[0]?.url)).toBe(false);
    expect(capPreloadItems(manual, { maxVideos: 1 })).toHaveLength(1);
  });

  it("warms the next playlist file and skips youtube", () => {
    const next = playlistPreloadItems(
      [
        { sceneId: "live", title: "Live", url: "https://cdn.example/live.png", mediaKind: "image" },
        { sceneId: "next", title: "Next", url: "https://cdn.example/next.mp4", mediaKind: "video" },
        { sceneId: "tube", title: "Tube", url: "https://youtu.be/abc", mediaKind: "youtube" },
      ],
      0,
    );
    expect(next.map((item) => item.id)).toEqual(["next"]);
    expect(playlistPreloadItems(
      [{ sceneId: "tube", title: "Tube", url: "https://youtu.be/abc", mediaKind: "youtube" }],
      0,
    )).toEqual([]);
  });

  it("keeps the current picture until the next file is decoded", () => {
    const current = { url: "https://cdn.example/current.png" };
    const next = { url: "https://cdn.example/next.png" };
    expect(
      visibleWhileLoading({ requested: next, showing: current, readyUrls: new Set() }),
    ).toEqual(current);
    expect(
      visibleWhileLoading({ requested: next, showing: current, readyUrls: new Set([next.url]) }),
    ).toEqual(next);
    expect(visibleWhileLoading({ requested: null, showing: current, readyUrls: new Set() })).toBeNull();
    expect(
      visibleWhileLoading({
        requested: { url: "https://cdn.example/replaced.png" },
        showing: current,
        readyUrls: new Set([current.url]),
      }),
    ).toEqual(current);
  });
});

describe("command to visible", () => {
  it("drops the decode wait once the wall browser has the file", () => {
    const cold = commandToVisibleMs({ pollMs: LED_DISPLAY_POLL_MS, decodeMs: 12_000, warmed: false });
    const warm = commandToVisibleMs({ pollMs: LED_DISPLAY_POLL_MS, decodeMs: 12_000, warmed: true });
    expect(cold).toEqual({ ms: 13_000, waitsForDecode: true });
    expect(warm).toEqual({ ms: LED_DISPLAY_POLL_MS, waitsForDecode: false });
    expect(warm.ms).toBeLessThan(cold.ms);
  });
});

describe("preload reports", () => {
  it("prefers a fresh ready report over an older error", () => {
    const now = 1_000_000;
    const summary = summarizePreloadReports(
      [
        { sceneId: "a", state: "error", updatedAtMs: now - 1_000, message: "Image did not load" },
        { sceneId: "a", state: "ready", updatedAtMs: now - 500, message: null },
        { sceneId: "b", state: "loading", updatedAtMs: now - 120_000, message: null },
      ],
      now,
    );
    expect(summary.get("a")).toEqual({ state: "ready", message: null });
    expect(summary.has("b")).toBe(false);
  });
});
