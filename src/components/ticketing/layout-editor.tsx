"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveVenueLayoutObjectsAction } from "@/actions/ticketing";
import { Button } from "@/components/ui/button";
import { VenueMap, type MapObject } from "@/components/ticketing/venue-map";
import { formatCents } from "@/lib/ticketing/money";

export type EditorObject = {
  id: string;
  name: string;
  object_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
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
  const [objects, setObjects] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const selected = objects.find((object) => object.id === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <VenueMap
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
          shape: object.shape,
          sellable: object.sellable,
          tableNumber: object.table_number,
          status: object.status ?? (object.sellable ? "available" : "unavailable"),
          capacity: object.capacity,
        }))}
        onSelect={setSelectedId}
        onMove={
          readOnly
            ? undefined
            : (id, x, y) => {
                setObjects((current) => current.map((object) => (object.id === id ? { ...object, x_position: x, y_position: y } : object)));
              }
        }
      />
      <aside className="rounded-xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">Object</h2>
        {selected ? (
          <dl className="mt-3 space-y-1">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{selected.name}</dd>
            <dt className="text-muted-foreground">Capacity</dt>
            <dd>{selected.capacity || "—"}</dd>
            {selected.default_price_cents != null ? (
              <>
                <dt className="text-muted-foreground">Default price</dt>
                <dd>{formatCents(selected.default_price_cents)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Position</dt>
            <dd>
              {selected.x_position}, {selected.y_position}
            </dd>
          </dl>
        ) : (
          <p className="mt-3 text-muted-foreground">Tap a table to inspect it. Drag to reposition.</p>
        )}
        {!readOnly ? (
          <Button
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await saveVenueLayoutObjectsAction(layoutId, objects);
                if (!result.ok) toast.error(result.message);
                else toast.success(result.message);
              });
            }}
          >
            Save layout
          </Button>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Read-only demo until the SQL migration is applied.</p>
        )}
      </aside>
    </div>
  );
}
