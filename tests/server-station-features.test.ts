import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVER_STATION_MENUS_ENABLED,
  isServerStationMenuEnabled,
  menuKeyForServerStationPath,
  normalizeServerStationMenusEnabled,
} from "@/lib/server-station/features";
import { parseYoutubeVideoUrl } from "@/lib/screens/youtube";

describe("Server Station menu flags", () => {
  it("defaults every menu on", () => {
    expect(normalizeServerStationMenusEnabled(null).youtube).toBe(true);
    expect(normalizeServerStationMenusEnabled({}).events).toBe(true);
  });

  it("accepts partial overrides", () => {
    const menus = normalizeServerStationMenusEnabled({ youtube: false, wall: false, nonsense: true });
    expect(menus.youtube).toBe(false);
    expect(menus.wall).toBe(false);
    expect(menus.events).toBe(true);
    expect(Object.keys(menus).sort()).toEqual(Object.keys(DEFAULT_SERVER_STATION_MENUS_ENABLED).sort());
  });

  it("maps paths to menu keys", () => {
    expect(menuKeyForServerStationPath("/server/youtube")).toBe("youtube");
    expect(menuKeyForServerStationPath("/server/youtube/phone")).toBe("youtube");
    expect(menuKeyForServerStationPath("/server")).toBeNull();
    expect(isServerStationMenuEnabled({ ...DEFAULT_SERVER_STATION_MENUS_ENABLED, upload: false }, "upload")).toBe(
      false,
    );
  });
});

describe("YouTube phone submit parsing", () => {
  it("accepts common guest paste formats", () => {
    expect(parseYoutubeVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoUrl("www.youtube.com/watch?v=dQw4w9WgXcQ")?.watchUrl).toContain("dQw4w9WgXcQ");
  });
});
