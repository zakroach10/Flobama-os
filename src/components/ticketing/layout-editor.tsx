"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveVenueLayoutObjectsAction } from "@/actions/ticketing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenueMap, type MapObject } from "@/components/ticketing/venue-map";
import {
  LAYOUT_OBJECT_LABELS,
  LAYOUT_OBJECT_TYPES,
  LAYOUT_SHAPE_LABELS,
  LAYOUT_SHAPES,
  type LayoutObjectType,
  type LayoutShape,
} from "@/lib/ticketing/constants";
import {
  applyCopiedSize,
  applyCopiedSizeToOthers,
  copiedSizeFrom,
  createLayoutObject,
  duplicateLayoutObject,
  isSellableLayoutType,
  LAYOUT_PALETTE,
  nextTableNumber,
  otherSameTypeLabel,
  sameTypeCount,
  type CopiedObjectSize,
} from "@/lib/ticketing/layout-objects";
import { formatCents } from "@/lib/ticketing/money";

export type EditorObject = {
  id: string;
  name: string;
  object_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  rotation?: number;
  capacity: number;
  sellable: boolean;
  shape: "rect" | "round" | "ellipse";
  table_number?: string | null;
  section?: string | null;
  default_price_cents?: number | null;
  status?: MapObject["status"];
};

export function LayoutEditor({
  layoutId,
  canvasWidth,
  canvasHeight,
  objects: initial,
  readOnly = false,
}: {
  layoutId: string;
  canvasWidth: number;
  canvasHeight: number;
  objects: EditorObject[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [objects, setObjects] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedSize, setCopiedSize] = useState<CopiedObjectSize | null>(null);
  const [pending, start] = useTransition();
  const selected = objects.find((object) => object.id === selectedId);
  const editor = !readOnly;
  const otherCount = selected ? sameTypeCount(objects, selected.id) : 0;
  const sizeToApply = copiedSize ?? (selected ? copiedSizeFrom(selected) : null);

  function patchSelected(patch: Partial<EditorObject>) {
    if (!selectedId) return;
    setObjects((current) => current.map((object) => (object.id === selectedId ? { ...object, ...patch } : object)));
  }

  function addObject(type: LayoutObjectType) {
    const created = createLayoutObject(type, nextTableNumber(objects));
    setObjects((current) => [...current, created]);
    setSelectedId(created.id);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = duplicateLayoutObject(selected, nextTableNumber(objects), {
      width: canvasWidth,
      height: canvasHeight,
    });
    setObjects((current) => [...current, copy]);
    setSelectedId(copy.id);
    toast.success(`Duplicated ${selected.name}.`);
  }

  function copySelectedSize() {
    if (!selected) return;
    setCopiedSize(copiedSizeFrom(selected));
    toast.success(`Copied ${selected.width} × ${selected.height}.`);
  }

  function applySizeToSelected() {
    if (!selected || !copiedSize) return;
    setObjects((current) =>
      current.map((object) => (object.id === selected.id ? applyCopiedSize(object, copiedSize) : object)),
    );
    toast.success(`Applied ${copiedSize.width} × ${copiedSize.height} to ${selected.name}.`);
  }

  function applySizeToOthers() {
    if (!selected || !sizeToApply) return;
    const count = sameTypeCount(objects, selected.id);
    if (count === 0) return;
    setObjects((current) => applyCopiedSizeToOthers(current, selected.id, sizeToApply));
    toast.success(`Applied ${sizeToApply.width} × ${sizeToApply.height} to ${count} ${otherSameTypeLabel(selected.object_type)}.`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        {editor ? (
          <div className="flex flex-wrap gap-2">
            {LAYOUT_PALETTE.map((type) => (
              <Button key={type} type="button" size="sm" variant="outline" onClick={() => addObject(type)}>
                {LAYOUT_OBJECT_LABELS[type]}
              </Button>
            ))}
          </div>
        ) : null}
        <VenueMap
          editor={editor}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          selectedId={selectedId}
          objects={objects.map((object) => ({
            id: object.id,
            name: object.name,
            objectType: object.object_type,
            x: object.x_position,
            y: object.y_position,
            width: object.width,
            height: object.height,
            rotation: object.rotation ?? 0,
            shape: object.shape,
            sellable: object.sellable,
            tableNumber: object.table_number,
            status: object.status ?? (object.sellable ? "available" : "unavailable"),
            capacity: object.capacity,
          }))}
          onSelect={setSelectedId}
          onMove={
            editor
              ? (id, x, y) => {
                  setObjects((current) => current.map((object) => (object.id === id ? { ...object, x_position: x, y_position: y } : object)));
                }
              : undefined
          }
          onResize={
            editor
              ? (id, width, height) => {
                  setObjects((current) => current.map((object) => (object.id === id ? { ...object, width, height } : object)));
                }
              : undefined
          }
        />
      </div>
      <aside className="h-fit space-y-4 rounded-xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">Object</h2>
        {selected ? (
          editor ? (
            <div className="space-y-3">
              <Field label="Name">
                <Input value={selected.name} onChange={(event) => patchSelected({ name: event.target.value })} />
              </Field>
              <Field label="Type">
                <select
                  className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                  value={selected.object_type}
                  onChange={(event) => {
                    const type = event.target.value as LayoutObjectType;
                    patchSelected({
                      object_type: type,
                      sellable: isSellableLayoutType(type),
                      shape: type === "table" ? "round" : selected.shape,
                    });
                  }}
                >
                  {LAYOUT_OBJECT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {LAYOUT_OBJECT_LABELS[type]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Section">
                <Input value={selected.section ?? ""} onChange={(event) => patchSelected({ section: event.target.value || null })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Width">
                  <Input
                    type="number"
                    value={selected.width}
                    onChange={(event) => patchSelected({ width: Math.max(12, Number(event.target.value) || 12) })}
                  />
                </Field>
                <Field label="Height">
                  <Input
                    type="number"
                    value={selected.height}
                    onChange={(event) => patchSelected({ height: Math.max(12, Number(event.target.value) || 12) })}
                  />
                </Field>
                <Field label="Rotation">
                  <Input
                    type="number"
                    value={selected.rotation ?? 0}
                    onChange={(event) => patchSelected({ rotation: Number(event.target.value) || 0 })}
                  />
                </Field>
                <Field label="Shape">
                  <select
                    className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                    value={selected.shape}
                    onChange={(event) => patchSelected({ shape: event.target.value as LayoutShape })}
                  >
                    {LAYOUT_SHAPES.map((shape) => (
                      <option key={shape} value={shape}>
                        {LAYOUT_SHAPE_LABELS[shape]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Capacity">
                <Input
                  type="number"
                  value={selected.capacity}
                  onChange={(event) => patchSelected({ capacity: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
              {isSellableLayoutType(selected.object_type as LayoutObjectType) ? (
                <>
                  <Field label="Table number">
                    <Input
                      value={selected.table_number ?? ""}
                      onChange={(event) => patchSelected({ table_number: event.target.value || null })}
                    />
                  </Field>
                  <Field label="Default price (USD)">
                    <Input
                      defaultValue={((selected.default_price_cents ?? 0) / 100).toFixed(2)}
                      onBlur={(event) => {
                        const cents = Math.round(Number.parseFloat(event.target.value) * 100);
                        if (Number.isFinite(cents) && cents >= 0) patchSelected({ default_price_cents: cents });
                      }}
                    />
                  </Field>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.sellable}
                      onCheckedChange={(checked) => patchSelected({ sellable: checked === true })}
                    />
                    Sellable as a whole table
                  </label>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {selected.x_position}, {selected.y_position}
                  {selected.default_price_cents != null ? ` · ${formatCents(selected.default_price_cents)}` : ""}
                </p>
              )}
              {copiedSize ? (
                <p className="text-xs text-muted-foreground">
                  Copied size {copiedSize.width} × {copiedSize.height}
                  {copiedSize.shape !== selected.shape ? ` · ${copiedSize.shape}` : ""}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={duplicateSelected}>
                  Duplicate
                </Button>
                <Button type="button" variant="outline" onClick={copySelectedSize}>
                  Copy size
                </Button>
              </div>
              <Button type="button" variant="outline" className="w-full" disabled={!copiedSize} onClick={applySizeToSelected}>
                Apply copied size
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={otherCount === 0} onClick={applySizeToOthers}>
                Apply size to {otherSameTypeLabel(selected.object_type)}
                {otherCount > 0 ? ` (${otherCount})` : ""}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setObjects((current) => current.filter((object) => object.id !== selected.id));
                  setSelectedId(null);
                }}
              >
                Delete
              </Button>
            </div>
          ) : (
            <dl className="mt-3 space-y-1">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{selected.name}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{LAYOUT_OBJECT_LABELS[selected.object_type as LayoutObjectType] ?? selected.object_type}</dd>
              <dt className="text-muted-foreground">Position</dt>
              <dd>
                {selected.x_position}, {selected.y_position}
              </dd>
            </dl>
          )
        ) : (
          <p className="text-muted-foreground">
            {editor ? "Add or duplicate a table, copy its size onto the others, then save." : "Tap a table to inspect it."}
          </p>
        )}
        {editor ? (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await saveVenueLayoutObjectsAction(layoutId, objects);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(result.message);
                const insertedIds = result.insertedIds ?? {};
                if (Object.keys(insertedIds).length > 0) {
                  setObjects((current) =>
                    current.map((object) => ({ ...object, id: insertedIds[object.id] ?? object.id })),
                  );
                  setSelectedId((id) => (id ? (insertedIds[id] ?? id) : id));
                }
                router.refresh();
              });
            }}
          >
            Save layout
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Read-only demo until the SQL migration is applied.</p>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
