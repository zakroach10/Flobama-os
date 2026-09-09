import { describe, expect, it } from "vitest";
import { createLayoutObject, isSellableLayoutType, isTempLayoutObjectId, nextTableNumber } from "@/lib/ticketing/layout-objects";
import { hintLayoutObjectTypeError } from "@/lib/ticketing/errors";

describe("layout object ids and defaults", () => {
  it("treats new- prefixes and non-uuids as temporary", () => {
    expect(isTempLayoutObjectId("new-6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isTempLayoutObjectId("demo-stage")).toBe(true);
    expect(isTempLayoutObjectId("22222222-2222-4222-8222-222222222222")).toBe(false);
  });

  it("numbers the next table after existing table numbers", () => {
    expect(nextTableNumber([])).toBe(1);
    expect(
      nextTableNumber([
        { object_type: "table", table_number: "2" },
        { object_type: "table", table_number: "28" },
        { object_type: "booth", table_number: "99" },
      ]),
    ).toBe(29);
  });

  it("creates sellable tables and non-sellable room markers", () => {
    const table = createLayoutObject("table", 12);
    expect(table.id.startsWith("new-")).toBe(true);
    expect(table.sellable).toBe(true);
    expect(table.table_number).toBe("12");
    expect(table.shape).toBe("round");
    expect(isSellableLayoutType("table")).toBe(true);

    const divider = createLayoutObject("divider", 3);
    expect(divider.sellable).toBe(false);
    expect(divider.height).toBe(12);
    expect(divider.object_type).toBe("divider");
    expect(isSellableLayoutType("restroom")).toBe(false);

    const restroom = createLayoutObject("restroom", 4);
    expect(restroom.name).toBe("Restroom");
    expect(restroom.section).toBe("Restrooms");
  });

  it("points at the enum migration when Postgres rejects divider or restroom", () => {
    const message = hintLayoutObjectTypeError('invalid input value for enum layout_object_type: "restroom"');
    expect(message).toContain("20260909000010_layout_object_types.sql");
  });
});
