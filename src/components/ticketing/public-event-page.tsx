"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VenueMap, type MapObject } from "@/components/ticketing/venue-map";
import { formatCents } from "@/lib/ticketing/money";
import { tableIncludesCopy } from "@/lib/ticketing/inventory";
import type { PublicTable, PublicTicketEvent, PublicTicketType } from "@/lib/ticketing/demo";
import { DEMO_DECOR } from "@/lib/ticketing/demo";
import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

type CartTicket = { typeId: string; quantity: number };

export function PublicTicketEventPage({
  eventId,
  initialEvent,
  initialTypes,
  initialTables,
  initialDecor,
  initialError,
}: {
  eventId: string;
  initialEvent: PublicTicketEvent | null;
  initialTypes: PublicTicketType[];
  initialTables: PublicTable[];
  initialDecor?: typeof DEMO_DECOR;
  initialError?: string | null;
}) {
  const [event, setEvent] = useState<PublicTicketEvent | null>(initialEvent);
  const [types, setTypes] = useState<PublicTicketType[]>(initialTypes);
  const [tables, setTables] = useState<PublicTable[]>(initialTables);
  const [decor, setDecor] = useState(initialDecor?.length ? initialDecor : DEMO_DECOR);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [cart, setCart] = useState<CartTicket[]>([]);
  const [selectedTable, setSelectedTable] = useState<PublicTable | null>(null);
  const [heldTableId, setHeldTableId] = useState<string | null>(null);
  const [holdMessage, setHoldMessage] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ orderNumber: string; qrTokens: string[]; totalCents: number } | null>(null);

  function refresh() {
    return fetch(`/api/public/v1/ticketing/events/${eventId}`, { cache: "no-store" }).then(async (response) => {
      const json = (await response.json()) as {
        event?: PublicTicketEvent;
        types?: PublicTicketType[];
        tables?: PublicTable[];
        decor?: typeof DEMO_DECOR;
        error?: string;
      };
      if (!response.ok) {
        setError(json.error ?? "Could not load this show.");
        return;
      }
      setEvent(json.event ?? null);
      setTypes(json.types ?? []);
      setTables(json.tables ?? []);
      if (json.decor?.length) setDecor(json.decor);
      setError(null);
    });
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 8000);
    return () => window.clearInterval(timer);
    // eventId is the listing key; refresh closes over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const subtotal = useMemo(() => {
    let total = 0;
    for (const item of cart) {
      const type = types.find((row) => row.id === item.typeId);
      if (type) total += type.priceCents * item.quantity;
    }
    const table = tables.find((row) => row.id === heldTableId);
    if (table) total += table.priceCents;
    return total;
  }, [cart, types, tables, heldTableId]);

  async function holdTable(table: PublicTable) {
    setPending(true);
    const response = await fetch("/api/public/v1/ticketing/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, tableId: table.id }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!json.ok) {
      setHoldMessage(json.error ?? "Could not hold that table.");
      void refresh();
      return;
    }
    setHeldTableId(table.id);
    setSelectedTable(null);
    setHoldMessage(`${table.name} is held for 10 minutes.`);
    setCheckoutOpen(true);
    void refresh();
  }

  async function holdTickets(typeId: string, quantity: number) {
    setPending(true);
    const response = await fetch("/api/public/v1/ticketing/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, ticketTypeId: typeId, quantity }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!json.ok) {
      setHoldMessage(json.error ?? "Those tickets are gone.");
      return;
    }
    setCart((current) => {
      const rest = current.filter((item) => item.typeId !== typeId);
      return [...rest, { typeId, quantity }];
    });
    setHoldMessage("Tickets held for 10 minutes.");
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-[#f4ebe3]">
        <FlobamaLogo className="mb-6 w-[240px]" />
        <h1 className="text-3xl font-semibold">Tickets unavailable</h1>
        <p className="mt-3 text-[#c9b8aa]">{error}</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-[#c9b8aa]">
        Loading this show…
      </main>
    );
  }

  const start = DateTime.fromISO(event.startsAt, { zone: "utc" }).setZone(DEFAULT_VENUE_TIMEZONE);
  const doors = event.doorsAt
    ? DateTime.fromISO(event.doorsAt, { zone: "utc" }).setZone(DEFAULT_VENUE_TIMEZONE)
    : start.minus({ hours: 1 });

  const mapObjects: MapObject[] = [
    ...decor.map((item) => ({
      id: item.id,
      name: item.name,
      objectType: item.type,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    })),
    ...tables.map((table) => ({
      id: table.id,
      name: table.name,
      objectType: "table",
      x: table.x,
      y: table.y,
      width: table.width,
      height: table.height,
      shape: table.shape,
      status: table.status,
      sellable: table.status === "available",
      vip: table.vip,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
    })),
  ];

  return (
    <main className="min-h-full bg-[#14110f] text-[#f4ebe3]">
      <div className="border-b border-[#5c2a22] bg-[#1b1612] px-4 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <FlobamaLogo className="w-[180px] sm:w-[220px]" />
          <p className="text-xs tracking-[0.22em] text-[#d36b4a] uppercase">Tickets</p>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm tracking-[0.22em] text-[#d36b4a] uppercase">{event.artists.join(" · ") || "Live music"}</p>
        <h1 className="mt-2 font-serif text-5xl leading-none font-black tracking-tight uppercase sm:text-7xl">
          {event.title}
        </h1>
        <p className="mt-4 text-lg text-[#c9b8aa]">
          {start.toFormat("cccc, LLL d · h:mm a")} · Doors {doors.toFormat("h:mm a")}
        </p>
        <p className="mt-2 text-sm text-[#8a7368]">{event.locationLabel}</p>
        <a href="#tickets" className="mt-8 inline-flex h-12 items-center rounded-lg bg-[#d36b4a] px-6 text-sm font-semibold tracking-wide text-white uppercase">
          Get tickets
        </a>
        {event.tablesEnabled ? (
          <a href="#tables" className="mt-8 ml-3 inline-flex h-12 items-center rounded-lg border border-[#5c2a22] px-6 text-sm font-semibold tracking-wide uppercase">
            View table map
          </a>
        ) : null}
      </section>

      <section id="tickets" className="mx-auto grid max-w-5xl gap-6 px-4 pb-10 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">General admission</h2>
          {types.map((type) => {
            const inCart = cart.find((item) => item.typeId === type.id)?.quantity ?? 0;
            return (
              <div key={type.id} className="rounded-xl border border-[#3a2f28] bg-[#1b1612] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{type.name}</p>
                    <p className="mt-1 text-sm text-[#c9b8aa]">{type.description}</p>
                    <p className="mt-2 text-sm text-[#8a7368]">{type.remaining} remaining</p>
                  </div>
                  <p className="text-xl font-semibold">{formatCents(type.priceCents)}</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <select
                    className="h-11 rounded-lg border border-[#3a2f28] bg-[#14110f] px-3 text-sm"
                    value={inCart}
                    onChange={(event) => {
                      const quantity = Number(event.target.value);
                      if (!quantity) {
                        setCart((current) => current.filter((item) => item.typeId !== type.id));
                        return;
                      }
                      void holdTickets(type.id, quantity);
                    }}
                    aria-label={`${type.name} quantity`}
                  >
                    {Array.from({ length: type.maxPerOrder + 1 }, (_, index) => (
                      <option key={index} value={index}>
                        {index}
                      </option>
                    ))}
                  </select>
                  <Button type="button" disabled={pending || type.remaining <= 0} onClick={() => void holdTickets(type.id, Math.max(1, inCart || 1))}>
                    Add
                  </Button>
                </div>
              </div>
            );
          })}

          {event.tablesEnabled ? (
            <div className="space-y-3" id="tables">
              <h2 className="text-xl font-semibold">VIP tables</h2>
              <p className="text-sm text-[#c9b8aa]">Tap an available table. FloBama holds it for 10 minutes while you check out.</p>
              <VenueMap
                objects={mapObjects}
                canvasWidth={event.canvasWidth}
                canvasHeight={event.canvasHeight}
                selectedId={selectedTable?.id ?? heldTableId}
                onSelect={(id) => {
                  const table = tables.find((row) => row.id === id);
                  if (table) setSelectedTable(table);
                }}
              />
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-xl border border-[#3a2f28] bg-[#1b1612] p-4">
          <h2 className="font-semibold">Your order</h2>
          {holdMessage ? <p className="mt-2 text-sm text-[#f0a089]">{holdMessage}</p> : null}
          <ul className="mt-3 space-y-2 text-sm">
            {cart.map((item) => {
              const type = types.find((row) => row.id === item.typeId);
              if (!type) return null;
              return (
                <li key={item.typeId}>
                  {item.quantity} × {type.name} · {formatCents(type.priceCents * item.quantity)}
                </li>
              );
            })}
            {heldTableId ? (
              <li>{tables.find((row) => row.id === heldTableId)?.name} · {formatCents(tables.find((row) => row.id === heldTableId)?.priceCents ?? 0)}</li>
            ) : null}
            {cart.length === 0 && !heldTableId ? <li className="text-[#8a7368]">Nothing selected yet.</li> : null}
          </ul>
          <p className="mt-4 text-lg font-semibold">{formatCents(subtotal)}</p>
          <Button className="mt-4 w-full" disabled={subtotal <= 0 && !heldTableId} onClick={() => setCheckoutOpen(true)}>
            Checkout
          </Button>
        </aside>
      </section>

      <section className="mx-auto max-w-5xl space-y-4 px-4 pb-16 text-sm text-[#c9b8aa]">
        <h2 className="text-lg font-semibold text-[#f4ebe3]">About this night</h2>
        <p>{event.description}</p>
        <p>Age: {event.ageRestriction}</p>
        <p>{event.parkingNotes}</p>
        <p>{event.refundPolicy}</p>
        <p>{event.venueNotes}</p>
      </section>

      <Sheet open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <SheetContent side="bottom" className="bg-[#1b1612] text-[#f4ebe3]">
          {selectedTable ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-[#f4ebe3]">{selectedTable.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 px-4 pb-6 text-sm">
                <p>{selectedTable.section} · Seats {selectedTable.capacity}</p>
                <p className="text-2xl font-semibold">{formatCents(selectedTable.priceCents)}</p>
                <p className="text-[#c9b8aa]">{tableIncludesCopy(selectedTable.capacity)}</p>
                <p className="uppercase tracking-wide text-[#8a7368]">{selectedTable.status}</p>
                <Button
                  className="mt-4 w-full"
                  disabled={selectedTable.status !== "available" || pending}
                  onClick={() => void holdTable(selectedTable)}
                >
                  Reserve table — {formatCents(selectedTable.priceCents)}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        eventId={eventId}
        tickets={cart}
        pending={pending}
        setPending={setPending}
        onPaid={setResult}
      />

      {result ? <TicketReceipt orderNumber={result.orderNumber} tokens={result.qrTokens} totalCents={result.totalCents} /> : null}
    </main>
  );
}

function CheckoutSheet({
  open,
  onOpenChange,
  eventId,
  tickets,
  pending,
  setPending,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  tickets: CartTicket[];
  pending: boolean;
  setPending: (value: boolean) => void;
  onPaid: (value: { orderNumber: string; qrTokens: string[]; totalCents: number }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function pay() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/public/v1/ticketing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, firstName, lastName, email, phone, tickets }),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      error?: string;
      orderNumber?: string;
      qrTokens?: string[];
      totalCents?: number;
    };
    setPending(false);
    if (!json.ok) {
      setMessage(json.error ?? "Checkout failed.");
      return;
    }
    onPaid({
      orderNumber: json.orderNumber ?? "",
      qrTokens: json.qrTokens ?? [],
      totalCents: json.totalCents ?? 0,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#1b1612] text-[#f4ebe3] sm:max-w-lg sm:rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="text-[#f4ebe3]">Guest checkout</SheetTitle>
        </SheetHeader>
        <form
          className="space-y-3 px-4 pb-8"
          onSubmit={(event) => {
            event.preventDefault();
            void pay();
          }}
        >
          <p className="text-sm text-[#c9b8aa]">No account required. Payment uses the FloBama mock adapter until Stripe is connected.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
          </div>
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field label="Phone" value={phone} onChange={setPhone} />
          {message ? <p className="text-sm text-[#f0a089]">{message}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Holding inventory…" : "Pay and get tickets"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[#c9b8aa]">{label}</Label>
      <Input className="border-[#3a2f28] bg-[#14110f] text-[#f4ebe3]" value={value} type={type} onChange={(event) => onChange(event.target.value)} required={label !== "Phone"} />
    </div>
  );
}

function TicketReceipt({
  orderNumber,
  tokens,
  totalCents,
}: {
  orderNumber: string;
  tokens: string[];
  totalCents: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const token = tokens[0];
    if (!token) return;
    void QRCode.toDataURL(`${window.location.origin}/t/${token}`, { margin: 1, width: 280 }).then(setSrc);
  }, [tokens]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-[#1b1612] p-6 text-center text-[#f4ebe3]">
        <FlobamaLogo className="mx-auto mb-4 w-[180px]" />
        <p className="text-sm tracking-[0.2em] text-[#d36b4a] uppercase">You are on the list</p>
        <p className="mt-2 text-2xl font-semibold">Order {orderNumber}</p>
        <p className="mt-1 text-[#c9b8aa]">{formatCents(totalCents)}</p>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Ticket QR code" className="mx-auto mt-5 rounded-lg bg-white p-3" />
        ) : null}
        <p className="mt-4 text-sm text-[#8a7368]">Show this at the door. The QR is a random token, not your personal details.</p>
        {tokens[0] ? (
          <a className="mt-4 inline-block text-sm underline" href={`/t/${tokens[0]}`}>
            Open ticket page
          </a>
        ) : null}
      </div>
    </div>
  );
}
