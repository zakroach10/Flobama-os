"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addWeekEventsSlideAction,
  archiveScreenAdAction,
  createScreenAdRecordAction,
  reorderScreenAdsAction,
  updateScreenAdAction,
} from "@/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCREEN_TRANSITION_LABELS, SCREEN_TRANSITIONS, type ScreenTransition } from "@/lib/constants";
import { isWeekEventsAd, type StaffScreenAd } from "@/lib/screens/playlist";
import type { PublicSupabaseEnv } from "@/lib/env";
import { describeUploadFailure, extensionForFile, MAX_SCREEN_AD_BYTES, mediaKindForFile } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function VerticalAdsPanel({
  ads,
  venueId,
  displayUrl,
  supabaseEnv,
}: {
  ads: StaffScreenAd[];
  venueId: string;
  displayUrl: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("10");
  const [transition, setTransition] = useState<ScreenTransition>("fade");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Vertical screens</h2>
        <p className="text-sm text-muted-foreground">
          One shared 1080×1920 playlist. Point every vertical player at this URL. Add a live “this week”
          slide to pull public shows for the current Sunday–Saturday week.
        </p>
        <p className="mt-2 text-sm break-all">{displayUrl}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() => {
            void navigator.clipboard.writeText(displayUrl);
            setCopied(true);
            toast.success("Copied display URL");
          }}
        >
          {copied ? "Copied" : "Copy display URL"}
        </Button>
      </div>

      <form
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!file) {
            toast.error("Choose an image or video.");
            return;
          }
          startTransition(async () => {
            const result = await uploadAdFromBrowser({
              file,
              venueId,
              title,
              duration,
              transition,
              sortOrder: ads.length,
              supabaseEnv,
            });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(result.message);
            setTitle("");
            setFile(null);
            router.refresh();
          });
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ad-file">File</Label>
          <input
            id="ad-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            className="h-11 min-h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              if (next && next.size > MAX_SCREEN_AD_BYTES) {
                toast.error("File must be 50 MB or smaller.");
                setFile(null);
                e.target.value = "";
                return;
              }
              if (next?.type.startsWith("video/")) setDuration("");
              else if (next) setDuration((value) => value || "10");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-title">Title</Label>
          <Input id="ad-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Happy Hour" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-duration">Seconds on screen</Label>
          <Input
            id="ad-duration"
            type="number"
            min={1}
            max={600}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Images need a hold time (10 seconds is typical). Leave blank on videos to play the file through.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-transition">Transition</Label>
          <select
            id="ad-transition"
            className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={transition}
            onChange={(e) => setTransition(e.target.value as ScreenTransition)}
          >
            {SCREEN_TRANSITIONS.map((value) => (
              <option key={value} value={value}>
                {SCREEN_TRANSITION_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Add to rotation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || ads.some((ad) => isWeekEventsAd(ad))}
            onClick={() =>
              startTransition(async () => {
                const result = await addWeekEventsSlideAction();
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              })
            }
          >
            Add this week’s events
          </Button>
        </div>
      </form>

      {ads.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          No ads yet. Upload a still or video, or add this week’s events.
        </p>
      ) : (
        <ul className="space-y-3">
          {ads.map((ad, index) => (
            <AdRow
              key={ad.id}
              ad={ad}
              canUp={index > 0}
              canDown={index < ads.length - 1}
              ids={ads.map((item) => item.id)}
              pending={pending}
              onRefresh={() => router.refresh()}
              run={startTransition}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdRow({
  ad,
  canUp,
  canDown,
  ids,
  pending,
  onRefresh,
  run,
}: {
  ad: StaffScreenAd;
  canUp: boolean;
  canDown: boolean;
  ids: string[];
  pending: boolean;
  onRefresh: () => void;
  run: (fn: () => Promise<void>) => void;
}) {
  const [title, setTitle] = useState(ad.title);
  const [duration, setDuration] = useState(ad.duration_seconds ? String(ad.duration_seconds) : "");
  const [transition, setTransition] = useState<ScreenTransition>(ad.transition);
  const [enabled, setEnabled] = useState(ad.enabled);

  function move(direction: -1 | 1) {
    const next = [...ids];
    const index = next.indexOf(ad.id);
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    run(async () => {
      const result = await reorderScreenAdsAction({ ids: next });
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        onRefresh();
      }
    });
  }

  return (
    <li className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[96px_1fr]">
      <div className="overflow-hidden rounded-md bg-muted">
        {isWeekEventsAd(ad) ? (
          <div className="flex h-24 w-full items-center justify-center bg-[#1b1612] px-2 text-center text-xs text-[#e4c4b0]">
            This week
          </div>
        ) : ad.media_kind === "video" ? (
          <video src={ad.public_url} muted className="h-24 w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.public_url} alt="" className="h-24 w-full object-cover" />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={`Title for ${ad.title}`} />
        <Input
          type="number"
          min={1}
          max={600}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          aria-label="Duration seconds"
          placeholder={ad.media_kind === "video" ? "Full video" : isWeekEventsAd(ad) ? "20" : "10"}
        />
        <select
          className="h-11 min-h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
          value={transition}
          onChange={(e) => setTransition(e.target.value as ScreenTransition)}
          aria-label="Transition"
        >
          {SCREEN_TRANSITIONS.map((value) => (
            <option key={value} value={value}>
              {SCREEN_TRANSITION_LABELS[value]}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          In rotation
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await updateScreenAdAction({
                  id: ad.id,
                  title,
                  durationSeconds: duration ? Number(duration) : null,
                  transition,
                  enabled,
                  mediaKind: isWeekEventsAd(ad) ? "image" : ad.media_kind,
                });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  onRefresh();
                }
              })
            }
          >
            Save
          </Button>
          <Button type="button" variant="outline" disabled={!canUp || pending} onClick={() => move(-1)}>
            Up
          </Button>
          <Button type="button" variant="outline" disabled={!canDown || pending} onClick={() => move(1)}>
            Down
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await archiveScreenAdAction(ad.id);
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  onRefresh();
                }
              })
            }
          >
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

async function uploadAdFromBrowser(input: {
  file: File;
  venueId: string;
  title: string;
  duration: string;
  transition: ScreenTransition;
  sortOrder: number;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const mediaKind = mediaKindForFile(input.file);
  if (!mediaKind) return { ok: false, message: "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM)." };
  if (input.file.size === 0) return { ok: false, message: "Choose an image or video file." };
  if (input.file.size > MAX_SCREEN_AD_BYTES) return { ok: false, message: "File must be 50 MB or smaller." };

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false,
      message: "The public Supabase URL and anon key are missing from this deployment. SQL is not the issue — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.",
    };
  }

  const title = input.title.trim() || input.file.name.replace(/\.[^.]+$/, "");
  const durationSeconds = input.duration.trim()
    ? Number(input.duration)
    : mediaKind === "image"
      ? 10
      : null;
  const id = crypto.randomUUID();
  const ext = extensionForFile(input.file) ?? (mediaKind === "video" ? "mp4" : "jpg");
  const storagePath = `${input.venueId}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType: input.file.type || (mediaKind === "video" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  });
  if (uploadError) return { ok: false, message: describeUploadFailure(uploadError.message) };

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const result = await createScreenAdRecordAction({
    id,
    title,
    durationSeconds,
    transition: input.transition,
    enabled: true,
    mediaKind,
    storagePath,
    publicUrl,
    sortOrder: input.sortOrder,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false, message: describeUploadFailure(result.message) };
  }
  return result;
}
