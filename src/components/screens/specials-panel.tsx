"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addPlaylistSpecialItemAction,
  archiveMenuSpecialAction,
  updateMenuSpecialAction,
} from "@/actions/playlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MENU_SPECIAL_CATEGORIES,
  MENU_SPECIAL_CATEGORY_LABELS,
  SCREEN_PLAYLISTS_SQL,
  SPECIAL_DEFAULT_SECONDS,
  type MenuSpecialCategory,
} from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";
import { specialIsLive, type StaffMenuSpecial } from "@/lib/screens/playlists";
import { uploadMenuSpecialFromBrowser } from "@/lib/screens/special-upload";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";

export function SpecialsPanel({
  specials,
  venueId,
  activePlaylistId,
  missingTable,
  supabaseEnv,
}: {
  specials: StaffMenuSpecial[];
  venueId: string;
  activePlaylistId: string | null;
  missingTable: boolean;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState<MenuSpecialCategory>("food");
  const [priceLabel, setPriceLabel] = useState("");
  const [duration, setDuration] = useState(String(SPECIAL_DEFAULT_SECONDS));
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [addToPlaylist, setAddToPlaylist] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  if (missingTable) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Food & drink specials</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">{SCREEN_PLAYLISTS_SQL}</code> in the Supabase SQL editor to enable
          specials and named playlists.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Food & drink specials</h2>
        <p className="text-sm text-muted-foreground">
          Upload specials graphics, then drop them into a playlist rotation. Optional start/end times keep
          expired specials off the screens automatically.
        </p>
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
            const result = await uploadMenuSpecialFromBrowser({
              file,
              venueId,
              title,
              subtitle,
              category,
              priceLabel,
              duration,
              startsAt,
              endsAt,
              addToPlaylistId: addToPlaylist ? activePlaylistId : null,
              supabaseEnv,
            });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(result.message);
            setTitle("");
            setSubtitle("");
            setPriceLabel("");
            setFile(null);
            router.refresh();
          });
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="special-file">Graphic</Label>
          <input
            id="special-file"
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
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-title">Title</Label>
          <Input
            id="special-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tuesday Tacos"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-category">Category</Label>
          <select
            id="special-category"
            className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as MenuSpecialCategory)}
          >
            {MENU_SPECIAL_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {MENU_SPECIAL_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-subtitle">Subtitle</Label>
          <Input
            id="special-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Soft shell, choice of protein"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-price">Price label</Label>
          <Input
            id="special-price"
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
            placeholder="$8"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-duration">Seconds on screen</Label>
          <Input
            id="special-duration"
            type="number"
            min={1}
            max={600}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-starts">Starts (optional)</Label>
          <Input
            id="special-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="special-ends">Ends (optional)</Label>
          <Input id="special-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={addToPlaylist}
            onChange={(e) => setAddToPlaylist(e.target.checked)}
            disabled={!activePlaylistId}
          />
          Add to the live playlist after upload
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Upload special"}
          </Button>
        </div>
      </form>

      {specials.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          No specials yet. Upload a food or drink graphic to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {specials.map((special) => (
            <SpecialRow
              key={special.id}
              special={special}
              activePlaylistId={activePlaylistId}
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

function SpecialRow({
  special,
  activePlaylistId,
  pending,
  onRefresh,
  run,
}: {
  special: StaffMenuSpecial;
  activePlaylistId: string | null;
  pending: boolean;
  onRefresh: () => void;
  run: (fn: () => Promise<void>) => void;
}) {
  const [title, setTitle] = useState(special.title);
  const [subtitle, setSubtitle] = useState(special.subtitle ?? "");
  const [category, setCategory] = useState<MenuSpecialCategory>(special.category);
  const [priceLabel, setPriceLabel] = useState(special.price_label ?? "");
  const [duration, setDuration] = useState(String(special.duration_seconds));
  const [enabled, setEnabled] = useState(special.enabled);
  const live = specialIsLive(special);

  return (
    <li className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[96px_1fr]">
      <div className="overflow-hidden rounded-md bg-muted">
        {special.media_kind === "video" ? (
          <video src={special.public_url} muted className="h-24 w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={special.public_url} alt="" className="h-24 w-full object-cover" />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Special title" />
        <select
          className="h-11 min-h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as MenuSpecialCategory)}
          aria-label="Category"
        >
          {MENU_SPECIAL_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {MENU_SPECIAL_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
        <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} aria-label="Subtitle" placeholder="Subtitle" />
        <Input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} aria-label="Price" placeholder="Price" />
        <Input
          type="number"
          min={1}
          max={600}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          aria-label="Duration seconds"
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled {live ? "(live window)" : "(outside window / off)"}
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await updateMenuSpecialAction({
                  id: special.id,
                  title,
                  subtitle,
                  category,
                  priceLabel,
                  durationSeconds: Number(duration) || SPECIAL_DEFAULT_SECONDS,
                  startsAt: special.starts_at,
                  endsAt: special.ends_at,
                  enabled,
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
          <Button
            type="button"
            variant="outline"
            disabled={pending || !activePlaylistId}
            onClick={() =>
              run(async () => {
                if (!activePlaylistId) return;
                const result = await addPlaylistSpecialItemAction({
                  playlistId: activePlaylistId,
                  specialId: special.id,
                });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  onRefresh();
                }
              })
            }
          >
            Add to live playlist
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await archiveMenuSpecialAction(special.id);
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  onRefresh();
                }
              })
            }
          >
            Archive
          </Button>
        </div>
      </div>
    </li>
  );
}
