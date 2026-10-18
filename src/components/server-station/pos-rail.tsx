"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CalendarDaysIcon, ClapperboardIcon, Music2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  listActiveServerStationItemsAction,
  listServerStationEventsAction,
  removeServerStationItemAction,
} from "@/actions/server-station";
import { serverStationKindLabel, serverStationPlacement } from "@/lib/server-station/item-labels";
import type { ServerStationEventCard } from "@/lib/server-station/events";
import { cn } from "@/lib/utils";

type RotationItem = {
  id: string;
  kind: string;
  title: string;
  status: string;
  thumbnail_url: string | null;
  show_now: boolean;
  playlist_item_id: string | null;
  override_starts_at: string | null;
};

function tonightLabel(event: ServerStationEventCard) {
  const who = event.artists.length ? event.artists.join(", ") : event.title;
  const extra = event.artists.length && event.title !== who ? event.title : null;
  return { who, extra };
}

export function ServerStationPosRail() {
  const [items, setItems] = useState<RotationItem[]>([]);
  const [events, setEvents] = useState<ServerStationEventCard[]>([]);
  const [rotationNote, setRotationNote] = useState<string | null>(null);
  const [tonightNote, setTonightNote] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;

    async function loadRotation(announce: boolean) {
      const result = await listActiveServerStationItemsAction();
      if (!alive) return;
      if (!result.ok) {
        setRotationNote(result.message);
        if (announce) toast.error(result.message);
        return;
      }
      setRotationNote(null);
      setItems(result.items as RotationItem[]);
    }

    async function loadTonight(announce: boolean) {
      const result = await listServerStationEventsAction({ bucket: "tonight" });
      if (!alive) return;
      if (!result.ok) {
        setTonightNote(result.message);
        if (announce) toast.error(result.message);
        return;
      }
      setTonightNote(null);
      setEvents(result.events.slice(0, 4));
    }

    void loadRotation(true);
    void loadTonight(true);
    const rotationTimer = window.setInterval(() => void loadRotation(false), 8000);
    const tonightTimer = window.setInterval(() => void loadTonight(false), 20000);
    return () => {
      alive = false;
      window.clearInterval(rotationTimer);
      window.clearInterval(tonightTimer);
    };
  }, []);

  function removeItem(item: RotationItem) {
    if (confirmId !== item.id) {
      setConfirmId(item.id);
      return;
    }
    startTransition(async () => {
      const result = await removeServerStationItemAction({ itemId: item.id });
      setConfirmId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setItems((current) => current.filter((row) => row.id !== item.id));
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-[24px] border border-white/10 bg-black/40 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <section className="flex min-h-0 flex-[1.2] flex-col">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#d36b4a]/20 text-[#f7efe6]">
            <ClapperboardIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#f7efe6]">Your rotation</h2>
            <p className="truncate text-xs text-[#e8d5c4]/80">Deals, messages, and celebrations</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {rotationNote ? <p className="text-sm text-amber-100">{rotationNote}</p> : null}
          {!rotationNote && items.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-black/25 px-3 py-4 text-sm text-[#e8d5c4]">
              Nothing from this station is in the rotation.
            </p>
          ) : null}
          {items.map((item) => {
            const kindLabel = serverStationKindLabel(item.kind);
            const confirming = confirmId === item.id;
            return (
              <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-black/40">
                  {item.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnail_url} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-[#e8d5c4] uppercase">{kindLabel}</p>
                  <p className="truncate text-sm font-bold text-[#f7efe6]">{item.title}</p>
                  <p className="truncate text-xs text-[#e8d5c4]/80">{serverStationPlacement(item)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  className={cn(
                    "ml-auto inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-semibold",
                    confirming ? "bg-red-700 text-white" : "border border-white/15 bg-white/5 text-[#f7efe6]",
                  )}
                >
                  {confirming ? "Confirm" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col border-t border-white/10 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-sky-400/15 text-[#f7efe6]">
            <Music2Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#f7efe6]">Playing tonight</h2>
            <p className="truncate text-xs text-[#e8d5c4]/80">Who is on the schedule</p>
          </div>
          <Link
            href="/server/events"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-[#e8d5c4]"
          >
            <CalendarDaysIcon className="size-4" aria-hidden />
            All
          </Link>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {tonightNote ? <p className="text-sm text-amber-100">{tonightNote}</p> : null}
          {!tonightNote && events.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-black/25 px-3 py-4 text-sm text-[#e8d5c4]">
              No show listed tonight.
            </p>
          ) : null}
          {events.map((event) => {
            const label = tonightLabel(event);
            return (
              <Link
                key={event.id}
                href="/server/events"
                className="block rounded-2xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <p className="truncate text-sm font-bold text-[#f7efe6]">{label.who}</p>
                <p className="truncate text-xs text-[#e8d5c4]">
                  {label.extra ? `${label.extra} · ` : ""}
                  {event.startLabel}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
