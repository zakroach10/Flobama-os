"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setBoothLiveEventAction, setBoothLowerThirdAction } from "@/actions/booth";
import { Button } from "@/components/ui/button";
import type { EventRow } from "@/lib/queries/events";
import { artistNames } from "@/lib/queries/events";
import { formatVenueDateTime } from "@/lib/timezone";
import { StatusBadge } from "@/components/status-badge";

export function BoothControls({
  events,
  liveEventId,
  lowerThirdVisible,
  timeZone,
  canControl,
}: {
  events: EventRow[];
  liveEventId: string | null;
  lowerThirdVisible: boolean;
  timeZone: string;
  canControl: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today on the floor</h2>
          <p className="text-sm text-muted-foreground">
            Now playing is shown on the overlay only when that event is published and public.
          </p>
        </div>
        {canControl ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setBoothLowerThirdAction(!lowerThirdVisible))}
            >
              {lowerThirdVisible ? "Hide lower third" : "Show lower third"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => setBoothLiveEventAction(null))}>
              Clear now playing
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Viewers can watch the overlay. Booth writes stay with managers.</p>
        )}
      </div>
      {events.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-sm text-muted-foreground">Nothing overlaps today.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {events.map((event) => {
            const live = event.id === liveEventId;
            return (
              <li key={event.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {event.title}
                    {live ? <span className="ml-2 text-xs tracking-wide text-primary uppercase">Now playing</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatVenueDateTime(event.starts_at, timeZone)}
                    {artistNames(event).length ? ` · ${artistNames(event).join(", ")}` : ""}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={event.status} />
                  </div>
                </div>
                {canControl ? (
                  <Button
                    type="button"
                    variant={live ? "secondary" : "outline"}
                    disabled={pending}
                    onClick={() => run(() => setBoothLiveEventAction(live ? null : event.id))}
                  >
                    {live ? "Clear" : "Set as now playing"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
