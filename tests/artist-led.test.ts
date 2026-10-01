import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  ARTIST_LED_AUTO_ROLL_MINUTES,
  artistLedFileMeta,
  artistLedMediaKindForFile,
  canAutoReplaceLedWall,
  houseLedScenes,
  isWithinArtistLedAutoWindow,
  MAX_ARTIST_LED_BYTES,
  pickPrimaryArtistId,
  shouldRunAdRollReset,
  venueLocalDateString,
} from "@/lib/screens/artist-led";

describe("artist LED helpers", () => {
  it("allows png, jpeg, heic logos and mp4 loops up to 2 GB", () => {
    expect(MAX_ARTIST_LED_BYTES).toBe(2 * 1024 * 1024 * 1024);
    expect(artistLedMediaKindForFile({ type: "video/mp4", name: "loop.mp4" })).toBe("video");
    expect(artistLedMediaKindForFile({ type: "image/png", name: "logo.png" })).toBe("image");
    expect(artistLedMediaKindForFile({ type: "image/jpeg", name: "logo.jpg" })).toBe("image");
    expect(artistLedMediaKindForFile({ type: "image/heic", name: "logo.heic" })).toBe("image");
    expect(artistLedMediaKindForFile({ type: "image/heif", name: "logo.heif" })).toBe("image");
    expect(artistLedMediaKindForFile({ type: "image/webp", name: "logo.webp" })).toBeNull();
    expect(artistLedMediaKindForFile({ type: "video/webm", name: "clip.webm" })).toBeNull();
    expect(artistLedFileMeta({ type: "image/jpeg", name: "logo.jpeg" }, "image")).toEqual({
      ext: "jpg",
      contentType: "image/jpeg",
    });
    expect(artistLedFileMeta({ type: "image/heic", name: "logo.heic" }, "image")).toEqual({
      ext: "heic",
      contentType: "image/heic",
    });
  });

  it("hides artist-owned scenes from the house list", () => {
    const scenes = [
      { id: "1", artist_id: null, kind: "obs" },
      { id: "2", artist_id: "artist-1", kind: "media" },
      { id: "3", artist_id: null, kind: "trivia" },
    ];
    expect(houseLedScenes(scenes).map((scene) => scene.id)).toEqual(["1", "3"]);
  });

  it("opens the auto-roll window five minutes before showtime", () => {
    const starts = DateTime.fromISO("2026-09-30T23:00:00.000Z", { zone: "utc" });
    const inWindow = starts.minus({ minutes: ARTIST_LED_AUTO_ROLL_MINUTES }).plus({ seconds: 30 }).toJSDate();
    const tooEarly = starts.minus({ minutes: ARTIST_LED_AUTO_ROLL_MINUTES + 1 }).toJSDate();
    const afterStart = starts.plus({ minutes: 1 }).toJSDate();
    expect(isWithinArtistLedAutoWindow(starts.toISO()!, inWindow)).toBe(true);
    expect(isWithinArtistLedAutoWindow(starts.toISO()!, tooEarly)).toBe(false);
    expect(isWithinArtistLedAutoWindow(starts.toISO()!, afterStart)).toBe(false);
  });

  it("picks the first billed artist with an LED config", () => {
    expect(
      pickPrimaryArtistId([
        { artist_id: "a", display_order: 0, hasLedConfig: false },
        { artist_id: "b", display_order: 1, hasLedConfig: true },
        { artist_id: "c", display_order: 2, hasLedConfig: true },
      ]),
    ).toBe("b");
  });

  it("does not auto-replace trivia or audience", () => {
    expect(canAutoReplaceLedWall(null)).toBe(true);
    expect(canAutoReplaceLedWall("media")).toBe(true);
    expect(canAutoReplaceLedWall("trivia")).toBe(false);
    expect(canAutoReplaceLedWall("audience")).toBe(false);
  });

  it("runs the 4AM ad-roll reset once per venue day", () => {
    const chicagoFour = DateTime.fromObject(
      { year: 2026, month: 9, day: 30, hour: 4, minute: 12 },
      { zone: "America/Chicago" },
    ).toUTC();
    const today = venueLocalDateString(chicagoFour.toJSDate(), "America/Chicago");
    expect(
      shouldRunAdRollReset({
        now: chicagoFour.toJSDate(),
        timeZone: "America/Chicago",
        lastResetOn: null,
      }),
    ).toBe(true);
    expect(
      shouldRunAdRollReset({
        now: chicagoFour.toJSDate(),
        timeZone: "America/Chicago",
        lastResetOn: today,
      }),
    ).toBe(false);
    const noon = DateTime.fromObject(
      { year: 2026, month: 9, day: 30, hour: 12, minute: 0 },
      { zone: "America/Chicago" },
    ).toUTC();
    expect(
      shouldRunAdRollReset({
        now: noon.toJSDate(),
        timeZone: "America/Chicago",
        lastResetOn: null,
      }),
    ).toBe(false);
  });
});
