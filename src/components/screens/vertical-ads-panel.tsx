"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  archiveScreenAdAction,
  reorderScreenAdsAction,
  updateScreenAdAction,
  uploadScreenAdAction,
} from "@/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCREEN_TRANSITION_LABELS, SCREEN_TRANSITIONS, type ScreenTransition } from "@/lib/constants";
import type { StaffScreenAd } from "@/lib/screens/playlist";

export function VerticalAdsPanel({ ads, displayUrl }: { ads: StaffScreenAd[]; displayUrl: string }) {
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
          One shared 1080×1920 playlist. Point every vertical player at this URL.
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
          const data = new FormData();
          data.set("file", file);
          data.set("title", title);
          data.set("durationSeconds", duration);
          data.set("transition", transition);
          startTransition(async () => {
            const result = await uploadScreenAdAction(data);
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
          <Input
            id="ad-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
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
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Add to rotation"}
          </Button>
        </div>
      </form>

      {ads.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          No ads yet. Upload the first still or video to fill the vertical screens.
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
        {ad.media_kind === "video" ? (
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
          placeholder={ad.media_kind === "video" ? "Full video" : "10"}
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
                  mediaKind: ad.media_kind,
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
