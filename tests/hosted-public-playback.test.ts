import { describe, expect, it, afterEach } from "vitest";
import {
  hostedPublicDisabledLedPayload,
  isHostedPublicPlaybackEnabled,
} from "../src/lib/screens/hosted-public-playback";

describe("hosted public playback gate", () => {
  const previousLed = process.env.HOSTED_PUBLIC_LED_ENABLED;
  const previousVertical = process.env.HOSTED_PUBLIC_VERTICAL_ENABLED;

  afterEach(() => {
    if (previousLed === undefined) delete process.env.HOSTED_PUBLIC_LED_ENABLED;
    else process.env.HOSTED_PUBLIC_LED_ENABLED = previousLed;
    if (previousVertical === undefined) delete process.env.HOSTED_PUBLIC_VERTICAL_ENABLED;
    else process.env.HOSTED_PUBLIC_VERTICAL_ENABLED = previousVertical;
  });

  it("defaults to enabled when signal flags are missing", () => {
    delete process.env.HOSTED_PUBLIC_LED_ENABLED;
    expect(isHostedPublicPlaybackEnabled("led", null)).toBe(true);
    expect(isHostedPublicPlaybackEnabled("led", { hostedLedPublicEnabled: true, hostedVerticalPublicEnabled: true })).toBe(
      true,
    );
  });

  it("respects venue disable flags", () => {
    delete process.env.HOSTED_PUBLIC_LED_ENABLED;
    expect(
      isHostedPublicPlaybackEnabled("led", {
        hostedLedPublicEnabled: false,
        hostedVerticalPublicEnabled: true,
      }),
    ).toBe(false);
    expect(
      isHostedPublicPlaybackEnabled("vertical", {
        hostedLedPublicEnabled: true,
        hostedVerticalPublicEnabled: false,
      }),
    ).toBe(false);
  });

  it("lets env force LED off even if DB says on", () => {
    process.env.HOSTED_PUBLIC_LED_ENABLED = "false";
    expect(
      isHostedPublicPlaybackEnabled("led", {
        hostedLedPublicEnabled: true,
        hostedVerticalPublicEnabled: true,
      }),
    ).toBe(false);
  });

  it("returns empty media in the disabled LED payload", () => {
    const payload = hostedPublicDisabledLedPayload(12);
    expect(payload.disabled).toBe(true);
    expect(payload.playlist).toEqual([]);
    expect(payload.active).toBeNull();
    expect(payload.reloadNonce).toBe(12);
  });
});
