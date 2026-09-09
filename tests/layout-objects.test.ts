import { describe, expect, it } from "vitest";
import {
  applyCopiedSizeToOthers,
  copiedSizeFrom,
  createLayoutObject,
  duplicateLayoutObject,
  isSellableLayoutType,
  isTempLayoutObjectId,
  nextTableNumber,
  otherSameTypeLabel,
  sameTypeCount,
} from "@/lib/ticketing/layout-objects";
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

describe("duplicate and copy size", () => {
  it("duplicates a table with the next number and an offset", () => {
    const table = createLayoutObject("table", 8);
    const copy = duplicateLayoutObject(table, 9, { width: 1200, height: 860 });
    expect(copy.id).not.toBe(table.id);
    expect(copy.id.startsWith("new-")).toBe(true);
    expect(copy.name).toBe("Table 9");
    expect(copy.table_number).toBe("9");
    expect(copy.width).toBe(table.width);
    expect(copy.height).toBe(table.height);
    expect(copy.x_position).toBe(table.x_position + 24);
    expect(copy.y_position).toBe(table.y_position + 24);
  });

  it("applies copied size to other objects of the same type", () => {
    const first = { ...createLayoutObject("table", 1), width: 120, height: 90, shape: "ellipse" as const };
    const second = createLayoutObject("table", 2);
    const booth = createLayoutObject("booth", 3);
    const size = copiedSizeFrom(first);
    const next = applyCopiedSizeToOthers([first, second, booth], first.id, size);
    expect(next[0]?.width).toBe(120);
    expect(next[1]).toMatchObject({ width: 120, height: 90, shape: "ellipse" });
    expect(next[2]).toMatchObject({ width: booth.width, height: booth.height, shape: booth.shape });
    expect(sameTypeCount([first, second, booth], first.id)).toBe(1);
    expect(otherSameTypeLabel("table")).toBe("other tables");
  });
});
