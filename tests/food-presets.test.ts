import { describe, expect, it } from "vitest";
import { BUILTIN_FOOD_PRESETS, foodPresetCanvasUrl, formatFoodPrice } from "@/lib/server-station/food-presets";

describe("food wall presets", () => {
  it("includes the house food promo list with prices", () => {
    expect(BUILTIN_FOOD_PRESETS).toHaveLength(15);
    expect(BUILTIN_FOOD_PRESETS.map((preset) => preset.food)).toContain("BBQ Nachos");
    expect(BUILTIN_FOOD_PRESETS.every((preset) => preset.imageUrl.startsWith("https://res.cloudinary.com/"))).toBe(
      true,
    );
  });

  it("formats prices for the wall graphic", () => {
    expect(formatFoodPrice("13.99")).toBe("$13.99");
    expect(formatFoodPrice("$5")).toBe("$5");
    expect(formatFoodPrice("  ")).toBe("");
  });

  it("loads Cloudinary photos through the same-origin proxy", () => {
    const url = BUILTIN_FOOD_PRESETS[0].imageUrl;
    expect(foodPresetCanvasUrl(url)).toBe(`/api/server-station/food-image?url=${encodeURIComponent(url)}`);
    expect(foodPresetCanvasUrl("blob:http://localhost/photo")).toBe("blob:http://localhost/photo");
  });
});