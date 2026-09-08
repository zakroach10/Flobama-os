"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearScreenTakeoverAction, startScreenTakeoverAction } from "@/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SCREEN_TAKEOVER_MAX_MINUTES,
  SCREEN_TAKEOVER_PRESETS,
  SCREEN_TAKEOVER_SQL,
} from "@/lib/constants";
import { isWeekEventsAd, type StaffScreenAd } from "@/lib/screens/playlist";
import {
  formatTakeoverUntil,
  takeoverMinutesLabel,
  takeoverRemainingLabel,
  type StaffTakeover,
} from "@/lib/screens/takeover";

export function TakeoverPanel({
  ads,
  takeover,
  missingTable,
}: {
  ads: StaffScreenAd[];
  takeover: StaffTakeover | null;
  missingTable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adId, setAdId] = useState(takeover?.adId ?? ads[0]?.id ?? "");
  const [untilCleared, setUntilCleared] = useState(takeover ? takeover.endsAt == null : false);
  const [minutes, setMinutes] = useState("30");

  useEffect(() => {
    if (takeover?.adId) setAdId(takeover.adId);
  }, [takeover?.adId]);

  if (missingTable) {
    return (
      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Take over TVs</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-foreground">{SCREEN_TAKEOVER_SQL}</code> in the Supabase SQL editor to
          hold a graphic for a set time.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Take over TVs</h2>
        <p className="text-sm text-muted-foreground">
          Hold one graphic on every vertical player while a band or event takes the room. The regular
          playlist resumes when the timer ends, or when you clear it. Graphics that are out of rotation
          can still take over.
        </p>
      </div>

      {takeover ? <ActiveTakeover takeover={takeover} /> : null}

      {ads.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          Upload a graphic first, then you can hold it on the TVs.
        </p>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!adId) {
              toast.error("Choose a graphic.");
              return;
            }
            const parsedMinutes = untilCleared ? null : Number(minutes);
            if (parsedMinutes != null && (!Number.isInteger(parsedMinutes) || parsedMinutes < 1)) {
              toast.error("Enter how many minutes to hold the graphic.");
              return;
            }
            startTransition(async () => {
              const result = await startScreenTakeoverAction({
                adId,
                minutes: parsedMinutes,
              });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success(result.message);
                router.refresh();
              }
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="takeover-ad">Graphic</Label>
            <select
              id="takeover-ad"
              className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={adId}
              onChange={(e) => setAdId(e.target.value)}
            >
              {ads.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.title}
                  {isWeekEventsAd(ad) ? " (this week)" : ad.enabled ? "" : " (not in rotation)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">How long</p>
            <div className="flex flex-wrap gap-2">
              {SCREEN_TAKEOVER_PRESETS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={!untilCleared && minutes === String(value) ? "default" : "outline"}
                  onClick={() => {
                    setUntilCleared(false);
                    setMinutes(String(value));
                  }}
                >
                  {takeoverMinutesLabel(value)}
                </Button>
              ))}
              <Button
                type="button"
                variant={untilCleared ? "default" : "outline"}
                onClick={() => setUntilCleared(true)}
              >
                Until cleared
              </Button>
            </div>
          </div>
          {untilCleared ? null : (
            <div className="space-y-2">
              <Label htmlFor="takeover-minutes">Custom minutes</Label>
              <Input
                id="takeover-minutes"
                type="number"
                min={1}
                max={SCREEN_TAKEOVER_MAX_MINUTES}
                value={minutes}
                onChange={(e) => {
                  setUntilCleared(false);
                  setMinutes(e.target.value);
                }}
              />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Starting…" : takeover ? "Replace takeover" : "Start takeover"}
            </Button>
            {takeover ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await clearScreenTakeoverAction();
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      router.refresh();
                    }
                  })
                }
              >
                Clear now
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}

function ActiveTakeover({ takeover }: { takeover: StaffTakeover }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!takeover.endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [takeover.endsAt]);

  return (
    <div className="rounded-lg border border-[#d36b4a]/40 bg-[#d36b4a]/8 px-4 py-3 text-sm">
      <p className="font-medium">Holding “{takeover.title}”</p>
      <p className="mt-1 text-muted-foreground">
        {takeoverRemainingLabel(takeover.endsAt, new Date(now))} · {formatTakeoverUntil(takeover.endsAt)}
      </p>
    </div>
  );
}
