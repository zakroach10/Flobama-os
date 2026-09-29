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
import type { PublicSupabaseEnv } from "@/lib/env";
import { uploadScreenAdFromBrowser } from "@/lib/screens/browser-upload";
import { isWeekEventsAd, type StaffScreenAd } from "@/lib/screens/playlist";
import {
  formatTakeoverUntil,
  takeoverMinutesLabel,
  takeoverRemainingLabel,
  type StaffTakeover,
} from "@/lib/screens/takeover";
import { MAX_SCREEN_AD_BYTES, screenAdTooLargeMessage } from "@/lib/screens/upload";

export function TakeoverPanel({
  ads,
  takeover,
  missingTable,
  venueId,
  supabaseEnv,
}: {
  ads: StaffScreenAd[];
  takeover: StaffTakeover | null;
  missingTable: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adId, setAdId] = useState(takeover?.adId ?? ads[0]?.id ?? "");
  const [syncedTakeoverId, setSyncedTakeoverId] = useState(takeover?.adId ?? "");
  const [untilCleared, setUntilCleared] = useState(takeover ? takeover.endsAt == null : false);
  const [minutes, setMinutes] = useState("30");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const incomingTakeoverId = takeover?.adId ?? "";
  if (incomingTakeoverId !== syncedTakeoverId) {
    setSyncedTakeoverId(incomingTakeoverId);
    if (incomingTakeoverId) setAdId(incomingTakeoverId);
  }

  if (missingTable) {
    return (
      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Takeover Ad Screens</h2>
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
        <h2 className="text-lg font-semibold">Takeover Ad Screens</h2>
        <p className="text-sm text-muted-foreground">
          Hold one graphic on every vertical player while a band or event takes the room. Upload an
          override here, or pick one already in the library. The regular playlist resumes when the
          timer ends, or when you clear it.
        </p>
      </div>

      {takeover ? <ActiveTakeover takeover={takeover} /> : null}

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const parsedMinutes = untilCleared ? null : Number(minutes);
          if (parsedMinutes != null && (!Number.isInteger(parsedMinutes) || parsedMinutes < 1)) {
            toast.error("Enter how many minutes to hold the graphic.");
            return;
          }
          if (!file && !adId) {
            toast.error("Upload an override graphic or choose one from the library.");
            return;
          }
          startTransition(async () => {
            let targetId = adId;
            if (file) {
              const uploaded = await uploadScreenAdFromBrowser({
                file,
                venueId,
                title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
                duration: "10",
                transition: "fade",
                sortOrder: ads.length,
                enabled: false,
                supabaseEnv,
              });
              if (!uploaded.ok || !uploaded.id) {
                toast.error(uploaded.message);
                return;
              }
              targetId = uploaded.id;
            }
            const result = await startScreenTakeoverAction({
              adId: targetId,
              minutes: parsedMinutes,
            });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              setTitle("");
              setFile(null);
              router.refresh();
            }
          });
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="takeover-file">Override graphic</Label>
          <input
            id="takeover-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            className="h-11 min-h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              if (next && next.size > MAX_SCREEN_AD_BYTES) {
                toast.error(screenAdTooLargeMessage());
                setFile(null);
                e.target.value = "";
                return;
              }
              setFile(next);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="takeover-title">Override title</Label>
          <Input
            id="takeover-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Band logo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="takeover-ad">Or use a library graphic</Label>
          <select
            id="takeover-ad"
            className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={adId}
            onChange={(e) => setAdId(e.target.value)}
            disabled={Boolean(file)}
          >
            {ads.length === 0 ? <option value="">No library graphics yet</option> : null}
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
