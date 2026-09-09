"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addEventTableAction,
  issueCompTableAction,
  moveTableReservationAction,
  saveEventLayoutObjectsAction,
  setEventTableStatusAction,
  staffIssueTableAction,
} from "@/actions/ticketing";
import { VenueMap } from "@/components/ticketing/venue-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TABLE_STATUS_LABELS, type TableInventoryStatus } from "@/lib/ticketing/constants";
import { formatCents } from "@/lib/ticketing/money";
import type { LayoutObjectRow } from "@/lib/queries/ticketing";

export function EventTableManager({
  eventId,
  canvasWidth,
  canvasHeight,
  objects: initial,
  canEdit,
}: {
  eventId: string;
  canvasWidth: number;
  canvasHeight: number;
  objects: LayoutObjectRow[];
  canEdit: boolean;
}) {
  const [objects, setObjects] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [pending, start] = useTransition();
  const selected = objects.find((object) => object.id === selectedId);
  const tables = objects.filter((object) => object.object_type === "table" || object.object_type === "booth");

  function updateSelected(patch: Partial<LayoutObjectRow>) {
    if (!selectedId) return;
    setObjects((current) => current.map((object) => (object.id === selectedId ? { ...object, ...patch } : object)));
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
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
            rotation: object.rotation,
            shape: object.shape,
            status: object.status,
            sellable: object.sellable,
            vip: object.vip,
            tableNumber: object.table_number,
            capacity: object.capacity,
          }))}
          onSelect={setSelectedId}
          onMove={
            canEdit
              ? (id, x, y) => {
                  setObjects((current) => current.map((object) => (object.id === id ? { ...object, x_position: x, y_position: y } : object)));
                }
              : undefined
          }
        />
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Table</th>
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Seats</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setSelectedId(table.id)}>
                      {table.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{table.section || "—"}</td>
                  <td className="px-3 py-2">{table.capacity}</td>
                  <td className="px-3 py-2">{formatCents(table.price_cents ?? 0)}</td>
                  <td className="px-3 py-2 uppercase">{TABLE_STATUS_LABELS[(table.status ?? "unavailable") as TableInventoryStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="h-fit space-y-4 rounded-xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">This show’s map</h2>
        <p className="text-muted-foreground">Moves, prices, and blocks apply only to this event. The master room stays unchanged.</p>
        {canEdit ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(async () =>
                  saveEventLayoutObjectsAction(
                    eventId,
                    objects.map((object) => ({
                      id: object.id,
                      x_position: object.x_position,
                      y_position: object.y_position,
                      width: object.width,
                      height: object.height,
                      name: object.name,
                      capacity: object.capacity,
                      price_cents: object.price_cents,
                      sellable: object.sellable,
                      vip: object.vip,
                      section: object.section,
                    })),
                  ),
                )
              }
            >
              Save this show’s layout
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => addEventTableAction(eventId))}>
              Add table
            </Button>
          </div>
        ) : null}
        {selected ? (
          <div className="space-y-3 border-t pt-3">
            <p className="font-medium">{selected.name}</p>
            <p className="text-muted-foreground">
              {selected.section || "Unsectioned"} · {selected.capacity} seats · {TABLE_STATUS_LABELS[(selected.status ?? "unavailable") as TableInventoryStatus]}
            </p>
            {canEdit ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="table-price">Price (USD)</Label>
                  <Input
                    id="table-price"
                    defaultValue={((selected.price_cents ?? 0) / 100).toFixed(2)}
                    onBlur={(event) => {
                      const cents = Math.round(Number.parseFloat(event.target.value) * 100);
                      if (Number.isFinite(cents)) updateSelected({ price_cents: cents });
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["available", "blocked", "unavailable"] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant="outline"
                      disabled={pending || selected.status === "sold"}
                      onClick={() => run(() => setEventTableStatusAction(eventId, selected.id, status))}
                    >
                      {TABLE_STATUS_LABELS[status]}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || selected.status !== "held"}
                    onClick={() => run(() => setEventTableStatusAction(eventId, selected.id, "available"))}
                  >
                    Release hold
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="guest-name">Guest name</Label>
                  <Input id="guest-name" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Zak Roach" />
                </div>
                <Button
                  disabled={pending || !guestName.trim()}
                  onClick={() => run(() => staffIssueTableAction({ eventId, objectId: selected.id, guestName, mode: "manual" }))}
                >
                  Sell manually
                </Button>
                <Button
                  variant="outline"
                  disabled={pending || !guestName.trim()}
                  onClick={() => run(() => issueCompTableAction(eventId, selected.id, guestName))}
                >
                  Comp table
                </Button>
                <div className="space-y-1">
                  <Label htmlFor="move-to">Move reservation to table #</Label>
                  <Input id="move-to" value={moveTo} onChange={(event) => setMoveTo(event.target.value)} placeholder="12" />
                </div>
                <Button
                  variant="outline"
                  disabled={pending || !moveTo.trim()}
                  onClick={() => {
                    const destination = tables.find((table) => table.table_number === moveTo.trim() || table.name === `Table ${moveTo.trim()}`);
                    if (!destination) {
                      toast.error("No matching table on this map.");
                      return;
                    }
                    run(() => moveTableReservationAction(eventId, selected.id, destination.id));
                  }}
                >
                  Move reservation
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">Tap a table to inspect or change it.</p>
        )}
      </aside>
    </div>
  );
}
