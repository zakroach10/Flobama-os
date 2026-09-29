import { describe, expect, it } from "vitest";
import { isMissingDisplaySignalRelation, normalizeReloadNonce } from "@/lib/screens/display-signals";

describe("display reload signals", () => {
  it("detects missing signal tables", () => {
    expect(isMissingDisplaySignalRelation('relation "screen_display_signals" does not exist')).toBe(true);
    expect(isMissingDisplaySignalRelation("permission denied")).toBe(false);
  });

  it("normalizes reload nonces", () => {
    expect(normalizeReloadNonce(3)).toBe(3);
    expect(normalizeReloadNonce("12")).toBe(12);
    expect(normalizeReloadNonce(0)).toBe(1);
    expect(normalizeReloadNonce(null)).toBe(1);
  });
});
