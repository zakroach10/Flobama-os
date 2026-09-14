import { describe, expect, it } from "vitest";
import { previewContainScale } from "@/lib/print/preview-scale";

describe("previewContainScale", () => {
  it("letterboxes a tall story into a phone viewport leftover", () => {
    const scale = previewContainScale(1080, 1920, 390, 420);
    expect(scale).toBeCloseTo(420 / 1920);
    expect(1080 * scale).toBeLessThanOrEqual(390);
    expect(1920 * scale).toBeLessThanOrEqual(420);
  });

  it("pillarboxes a landscape graphic into leftover height", () => {
    const scale = previewContainScale(1920, 1080, 720, 400);
    expect(scale).toBeCloseTo(400 / 1080);
    expect(1920 * scale).toBeLessThanOrEqual(720);
  });

  it("never upscales past 1", () => {
    expect(previewContainScale(400, 400, 800, 800)).toBe(1);
  });

  it("returns 0 when there is no room", () => {
    expect(previewContainScale(1080, 1080, 0, 500)).toBe(0);
    expect(previewContainScale(1080, 1080, 500, -10)).toBe(0);
  });
});
