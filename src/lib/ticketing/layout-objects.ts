import {
  LAYOUT_OBJECT_LABELS,
  type LayoutObjectType,
  type LayoutShape,
} from "@/lib/ticketing/constants";

export const LAYOUT_PALETTE: LayoutObjectType[] = [
  "table",
  "booth",
  "bar",
  "stage",
  "dance_floor",
  "standing",
  "vip_area",
  "entrance",
  "divider",
  "restroom",
  "label",
];

export function isTempLayoutObjectId(id: string) {
  return id.startsWith("new-") || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function isSellableLayoutType(type: LayoutObjectType) {
  return type === "table" || type === "booth";
}

const DEFAULTS: Record<
  LayoutObjectType,
  { width: number; height: number; shape: LayoutShape; capacity: number }
> = {
  table: { width: 88, height: 64, shape: "round", capacity: 4 },
  booth: { width: 100, height: 80, shape: "rect", capacity: 6 },
  bar: { width: 88, height: 280, shape: "rect", capacity: 0 },
  stage: { width: 360, height: 88, shape: "rect", capacity: 0 },
  dance_floor: { width: 280, height: 160, shape: "rect", capacity: 0 },
  standing: { width: 200, height: 140, shape: "rect", capacity: 0 },
  vip_area: { width: 200, height: 72, shape: "rect", capacity: 0 },
  entrance: { width: 160, height: 40, shape: "rect", capacity: 0 },
  divider: { width: 200, height: 12, shape: "rect", capacity: 0 },
  restroom: { width: 80, height: 80, shape: "rect", capacity: 0 },
  label: { width: 180, height: 32, shape: "rect", capacity: 0 },
  decor: { width: 80, height: 80, shape: "rect", capacity: 0 },
};

export function createLayoutObject(type: LayoutObjectType, index: number) {
  const preset = DEFAULTS[type];
  const sellable = isSellableLayoutType(type);
  const tableNumber = type === "table" ? String(index) : null;
  return {
    id: `new-${crypto.randomUUID()}`,
    name: type === "table" ? `Table ${index}` : LAYOUT_OBJECT_LABELS[type],
    object_type: type,
    x_position: 40 + ((index * 20) % 200),
    y_position: 40 + ((index * 16) % 160),
    width: preset.width,
    height: preset.height,
    rotation: 0,
    shape: preset.shape,
    capacity: preset.capacity,
    sellable,
    table_number: tableNumber,
    section: type === "restroom" ? "Restrooms" : type === "vip_area" ? "VIP" : null,
    default_price_cents: sellable ? (type === "booth" ? 25000 : 15000) : null,
  };
}

export type CopiedObjectSize = {
  width: number;
  height: number;
  shape: LayoutShape;
};

export function nextTableNumber(objects: Array<{ table_number?: string | null; object_type: string }>) {
  const numbers = objects
    .filter((object) => object.object_type === "table")
    .map((object) => Number.parseInt(object.table_number ?? "", 10))
    .filter((n) => Number.isFinite(n));
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export function copiedSizeFrom(object: { width: number; height: number; shape: LayoutShape }): CopiedObjectSize {
  return { width: object.width, height: object.height, shape: object.shape };
}

export function applyCopiedSize<T extends { width: number; height: number; shape: LayoutShape }>(object: T, size: CopiedObjectSize): T {
  return { ...object, width: size.width, height: size.height, shape: size.shape };
}

export function applyCopiedSizeToOthers<T extends { id: string; object_type: string; width: number; height: number; shape: LayoutShape }>(
  objects: T[],
  sourceId: string,
  size: CopiedObjectSize,
): T[] {
  const source = objects.find((object) => object.id === sourceId);
  if (!source) return objects;
  return objects.map((object) => {
    if (object.id === sourceId || object.object_type !== source.object_type) return object;
    return applyCopiedSize(object, size);
  });
}

export function sameTypeCount(objects: Array<{ id: string; object_type: string }>, sourceId: string) {
  const source = objects.find((object) => object.id === sourceId);
  if (!source) return 0;
  return objects.filter((object) => object.object_type === source.object_type && object.id !== sourceId).length;
}

export function otherSameTypeLabel(type: string) {
  switch (type) {
    case "table":
      return "other tables";
    case "booth":
      return "other booths";
    case "bar":
      return "other bars";
    case "stage":
      return "other stages";
    case "dance_floor":
      return "other dance floors";
    case "standing":
      return "other standing areas";
    case "vip_area":
      return "other VIP areas";
    case "entrance":
      return "other entrances";
    case "divider":
      return "other dividers";
    case "restroom":
      return "other restrooms";
    case "label":
      return "other labels";
    default:
      return "other objects of this type";
  }
}

export function duplicateLayoutObject<
  T extends {
    id: string;
    name: string;
    object_type: string;
    x_position: number;
    y_position: number;
    width: number;
    height: number;
    table_number?: string | null;
  },
>(object: T, nextIndex: number, canvas: { width: number; height: number }): T {
  const offset = 24;
  let x = object.x_position + offset;
  let y = object.y_position + offset;
  if (x + object.width > canvas.width) x = Math.max(0, object.x_position - offset);
  if (y + object.height > canvas.height) y = Math.max(0, object.y_position - offset);
  const isTable = object.object_type === "table";
  return {
    ...object,
    id: `new-${crypto.randomUUID()}`,
    x_position: x,
    y_position: y,
    name: isTable ? `Table ${nextIndex}` : object.name,
    table_number: isTable ? String(nextIndex) : object.table_number,
  };
}
