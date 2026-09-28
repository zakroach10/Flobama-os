import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LED_OBS_DMG_HREF } from "@/lib/constants";

describe("LED OBS disk image", () => {
  it("publishes a UDIF disk image from the sign-in page", () => {
    expect(LED_OBS_DMG_HREF).toBe("/downloads/FloBama-LED-OBS.dmg");
    const file = path.join(process.cwd(), "public", LED_OBS_DMG_HREF);
    const bytes = readFileSync(file);
    expect(bytes.byteLength).toBeGreaterThan(100_000);
    expect(bytes.subarray(bytes.byteLength - 512, bytes.byteLength - 508).toString()).toBe("koly");
  });
});
