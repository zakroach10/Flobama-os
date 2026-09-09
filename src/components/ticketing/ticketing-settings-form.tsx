"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { enableEventTicketingAction, saveTicketingSettingsAction, saveTicketTypeAction, deleteTicketTypeAction } from "@/actions/ticketing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_TYPE_KIND_LABELS, type TicketTypeKind } from "@/lib/ticketing/constants";
import { formatCents } from "@/lib/ticketing/money";
import type { EventTicketingRow, TicketTypeRow } from "@/lib/queries/ticketing";
import { DateTime } from "luxon";

function toLocal(iso: string | null, zone: string) {
  if (!iso) return "";
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm");
}

function fromLocal(value: string, zone: string) {
  if (!value) return null;
  return DateTime.fromISO(value, { zone }).toUTC().toISO();
}

export function TicketingSettingsForm({
  eventId,
  timezone,
  settings,
  types,
  canEdit,
}: {
  eventId: string;
  timezone: string;
  settings: EventTicketingRow | null;
  types: TicketTypeRow[];
  canEdit: boolean;
}) {
  const enabled = Boolean(settings?.enabled);
  const [pending, start] = useTransition();
  const [tablesEnabled, setTablesEnabled] = useState(settings?.tables_enabled ?? true);
  const [refundsEnabled, setRefundsEnabled] = useState(settings?.refunds_enabled ?? false);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Enable Ticketing</h2>
            <p className="text-sm text-muted-foreground">
              Off: this stays a normal Event Manager record. On: public tickets, tables, QR, and door check-in.
            </p>
          </div>
          {canEdit ? (
            <Button
              disabled={pending}
              variant={enabled ? "outline" : "default"}
              onClick={() =>
                start(async () => {
                  const result = await enableEventTicketingAction(eventId, !enabled);
                  if (!result.ok) toast.error(result.message);
                  else toast.success(result.message);
                })
              }
            >
              {enabled ? "Disable ticketing" : "Enable ticketing"}
            </Button>
          ) : null}
        </div>
      </section>

      {enabled ? (
        <>
          <form
            className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canEdit) return;
              const form = new FormData(event.currentTarget);
              start(async () => {
                const result = await saveTicketingSettingsAction(eventId, {
                  doorsAt: fromLocal(String(form.get("doorsAt") ?? ""), timezone),
                  capacity: String(form.get("capacity") ?? "") || null,
                  salesStart: fromLocal(String(form.get("salesStart") ?? ""), timezone),
                  salesEnd: fromLocal(String(form.get("salesEnd") ?? ""), timezone),
                  maxTicketsPerOrder: Number(form.get("maxTicketsPerOrder") ?? 8),
                  holdMinutes: Number(form.get("holdMinutes") ?? 10),
                  tablesEnabled,
                  refundsEnabled,
                  refundPolicy: String(form.get("refundPolicy") ?? "") || null,
                  ageRestriction: String(form.get("ageRestriction") ?? "") || null,
                  parkingNotes: String(form.get("parkingNotes") ?? "") || null,
                  venueNotes: String(form.get("venueNotes") ?? "") || null,
                });
                if (!result.ok) toast.error(result.message);
                else toast.success(result.message);
              });
            }}
          >
            <h2 className="sm:col-span-2 text-lg font-semibold">Show settings</h2>
            <Field label="Doors" name="doorsAt" type="datetime-local" defaultValue={toLocal(settings?.doors_at ?? null, timezone)} />
            <Field label="Capacity" name="capacity" type="number" defaultValue={settings?.capacity ? String(settings.capacity) : ""} />
            <Field label="Sales start" name="salesStart" type="datetime-local" defaultValue={toLocal(settings?.sales_start ?? null, timezone)} />
            <Field label="Sales end" name="salesEnd" type="datetime-local" defaultValue={toLocal(settings?.sales_end ?? null, timezone)} />
            <Field label="Max tickets per order" name="maxTicketsPerOrder" type="number" defaultValue={String(settings?.max_tickets_per_order ?? 8)} />
            <Field label="Hold minutes" name="holdMinutes" type="number" defaultValue={String(settings?.hold_minutes ?? 10)} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={tablesEnabled} onCheckedChange={(checked) => setTablesEnabled(checked === true)} />
              Table reservations on
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={refundsEnabled} onCheckedChange={(checked) => setRefundsEnabled(checked === true)} />
              Staff refunds allowed
            </label>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="ageRestriction">Age restriction</Label>
              <Input id="ageRestriction" name="ageRestriction" defaultValue={settings?.age_restriction ?? "21+ with valid ID"} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="parkingNotes">Parking</Label>
              <Textarea id="parkingNotes" name="parkingNotes" defaultValue={settings?.parking_notes ?? ""} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="venueNotes">Venue notes</Label>
              <Textarea id="venueNotes" name="venueNotes" defaultValue={settings?.venue_notes ?? ""} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="refundPolicy">Refund policy</Label>
              <Textarea id="refundPolicy" name="refundPolicy" defaultValue={settings?.refund_policy ?? ""} rows={3} />
            </div>
            {canEdit ? (
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  Save settings
                </Button>
              </div>
            ) : null}
          </form>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Ticket types</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {types.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">No ticket types yet.</li> : null}
              {types.map((type) => (
                <li key={type.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {TICKET_TYPE_KIND_LABELS[type.kind]} · {formatCents(type.price_cents)} · {type.quantity} inventory
                      {type.blocked_quantity ? ` · ${type.blocked_quantity} blocked` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await deleteTicketTypeAction(eventId, type.id);
                          if (!result.ok) toast.error(result.message);
                          else toast.success(result.message);
                        })
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? <AddTicketTypeForm eventId={eventId} /> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}

function AddTicketTypeForm({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();
  const [active, setActive] = useState(true);
  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
          const formEl = event.currentTarget;
          start(async () => {
          const result = await saveTicketTypeAction(eventId, {
            name: String(form.get("name") ?? ""),
            description: String(form.get("description") ?? "") || null,
            kind: String(form.get("kind") ?? "ga") as TicketTypeKind,
            price: String(form.get("price") ?? "0"),
            quantity: Number(form.get("quantity") ?? 0),
            blockedQuantity: Number(form.get("blockedQuantity") ?? 0),
            maxPerOrder: Number(form.get("maxPerOrder") ?? 8),
            active,
            visibility: String(form.get("visibility") ?? "public"),
          });
          if (!result.ok) toast.error(result.message);
          else {
            toast.success(result.message);
            formEl.reset();
          }
        });
      }}
    >
      <h3 className="sm:col-span-2 font-medium">Add ticket type</h3>
      <Field label="Name" name="name" type="text" defaultValue="" />
      <Field label="Price" name="price" type="text" defaultValue="20" />
      <Field label="Inventory" name="quantity" type="number" defaultValue="250" />
      <Field label="Blocked / comps held" name="blockedQuantity" type="number" defaultValue="0" />
      <Field label="Max per order" name="maxPerOrder" type="number" defaultValue="8" />
      <div className="space-y-1">
        <Label htmlFor="kind">Kind</Label>
        <select id="kind" name="kind" className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
          <option value="ga">General admission</option>
          <option value="vip">VIP</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" />
      </div>
      <input type="hidden" name="visibility" value="public" />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox checked={active} onCheckedChange={(checked) => setActive(checked === true)} />
        On sale
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Add ticket type
        </Button>
      </div>
    </form>
  );
}
