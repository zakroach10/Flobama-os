"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { checkInTicketAction } from "@/actions/ticketing";
import { searchDoorTicketsAction, type DoorTicketHit } from "@/actions/ticketing-door";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CheckInDesk({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DoorTicketHit[]>([]);
  const [active, setActive] = useState<DoorTicketHit | null>(null);
  const [pending, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScan = useRef<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const lookup = async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    const result = await searchDoorTicketsAction(eventId, q);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setHits(result.tickets);
    setActive(result.tickets[0] ?? null);
    if (result.tickets.length === 0) toast.error("No matching ticket.");
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    async function startCamera() {
      if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera scan needs a Chromium browser. Use search below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current || cancelled) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new (window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => {
            detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
          };
        }).BarcodeDetector({
          formats: ["qr_code"],
        });
        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              const token = value.split("/t/").pop() ?? value;
              if (token && token !== lastScan.current) {
                lastScan.current = token;
                await lookup(token);
              }
            }
          } catch {
            // keep scanning
          }
          window.setTimeout(() => void loop(), 700);
        };
        void loop();
      } catch {
        setCameraError("Camera permission denied. Search by name or order number.");
      }
    }
    void startCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
    // Camera loop captures lookup; re-bind when the event changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function checkIn(quantity: number) {
    if (!active) return;
    start(async () => {
      const result = await checkInTicketAction(active.id, quantity);
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
      await lookup(active.orderNumber || active.id);
    });
  }

  const remaining = active ? Math.max(0, active.admissionsTotal - active.admissionsCheckedIn) : 0;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Door check-in</p>
        <h1 className="text-3xl font-semibold tracking-tight">{eventTitle}</h1>
      </header>
      <Button className="h-14 w-full text-base" type="button" onClick={() => videoRef.current?.play()}>
        Scan ticket
      </Button>
      <video ref={videoRef} className="aspect-video w-full rounded-xl bg-black" muted playsInline />
      {cameraError ? <p className="text-sm text-muted-foreground">{cameraError}</p> : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(query);
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, email, phone, order, table, or QR token"
        />
        <Button type="submit">Search</Button>
      </form>
      {active ? (
        <section className="rounded-xl border bg-card p-5 text-center">
          <p className="text-xs tracking-[0.2em] text-emerald-700 uppercase">Valid ticket</p>
          <h2 className="mt-2 text-2xl font-semibold">{active.purchaser}</h2>
          <p className="text-muted-foreground">{active.orderNumber}</p>
          <p className="text-sm">{active.ticketType}</p>
          {active.tableName ? <p className="mt-1 text-lg font-medium">{active.tableName}</p> : null}
          <p className="mt-4 text-5xl font-black tabular-nums">
            {active.admissionsCheckedIn} / {active.admissionsTotal}
          </p>
          <p className="text-sm text-muted-foreground">checked in</p>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Button className="h-12" disabled={pending || remaining < 1} onClick={() => checkIn(1)}>
              +1 Guest
            </Button>
            <Button className="h-12" disabled={pending || remaining < 2} onClick={() => checkIn(Math.min(2, remaining))}>
              +2 Guests
            </Button>
            <Button className="h-12" disabled={pending || remaining < 1} onClick={() => checkIn(remaining)}>
              Check in all
            </Button>
          </div>
        </section>
      ) : null}
      {hits.length > 1 ? (
        <ul className="divide-y rounded-xl border text-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="flex min-h-12 w-full justify-between px-4 py-3 text-left" onClick={() => setActive(hit)}>
                <span>
                  {hit.purchaser}
                  {hit.tableName ? ` · ${hit.tableName}` : ""}
                </span>
                <span className="text-muted-foreground">{hit.orderNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
