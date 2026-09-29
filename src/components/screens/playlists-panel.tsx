"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  activateScreenPlaylistAction,
  addPlaylistWeekEventsAction,
  archivePlaylistItemAction,
  archiveScreenPlaylistAction,
  createScreenPlaylistAction,
  renameScreenPlaylistAction,
  reorderPlaylistItemsAction,
  updatePlaylistItemAction,
} from "@/actions/playlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SCREEN_PLAYLISTS_SQL,
  SCREEN_TRANSITION_LABELS,
  SCREEN_TRANSITIONS,
  type ScreenTransition,
} from "@/lib/constants";
import { ExportWeekSocialButton } from "@/components/print/export-week-social-button";
import { PrintWeekFlyerButton } from "@/components/print/print-week-flyer-button";
import { uploadScreenAdFromBrowser } from "@/lib/screens/browser-upload";
import type { PublicSupabaseEnv } from "@/lib/env";
import type { StaffPlaylistItem, StaffScreenPlaylist } from "@/lib/screens/playlists";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";

export function PlaylistsPanel({
  playlists,
  items,
  selectedPlaylistId,
  venueId,
  displayUrl,
  missingTable,
  supabaseEnv,
}: {
  playlists: StaffScreenPlaylist[];
  items: StaffPlaylistItem[];
  selectedPlaylistId: string | null;
  venueId: string;
  displayUrl: string;
  missingTable: boolean;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("10");
  const [transition, setTransition] = useState<ScreenTransition>("fade");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const selected = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;

  if (missingTable) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Playlists</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">{SCREEN_PLAYLISTS_SQL}</code> in the Supabase SQL editor to enable
          named playlist rotation. Until then, use the legacy ads list below if shown.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Playlists</h2>
        <p className="text-sm text-muted-foreground">
          Organize media and specials into sequenced rotations. The active playlist drives every vertical
          player at this URL.
        </p>
        <p className="mt-2 text-sm break-all">{displayUrl}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(displayUrl);
              setCopied(true);
              toast.success("Copied display URL");
            }}
          >
            {copied ? "Copied" : "Copy display URL"}
          </Button>
          <PrintWeekFlyerButton />
          <ExportWeekSocialButton />
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-2">
          <Label htmlFor="playlist-select">Playlist</Label>
          <select
            id="playlist-select"
            className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={selectedPlaylistId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              router.replace(id ? `/screens?tab=vertical&playlist=${id}` : "/screens?tab=vertical", {
                scroll: false,
              });
            }}
          >
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
                {playlist.is_active ? " (live)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || !selected || selected.is_active}
            onClick={() =>
              startTransition(async () => {
                if (!selected) return;
                const result = await activateScreenPlaylistAction({ id: selected.id });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              })
            }
          >
            Set live
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !selected || selected.is_active}
            onClick={() =>
              startTransition(async () => {
                if (!selected) return;
                const result = await archiveScreenPlaylistAction(selected.id);
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.replace("/screens?tab=vertical", { scroll: false });
                  router.refresh();
                }
              })
            }
          >
            Archive
          </Button>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await createScreenPlaylistAction({
              name: name || "New playlist",
              activate: playlists.length === 0,
            });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              setName("");
              if (result.id) {
                router.replace(`/screens?tab=vertical&playlist=${result.id}`, { scroll: false });
              }
              router.refresh();
            }
          });
        }}
      >
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="new-playlist">New playlist</Label>
          <Input
            id="new-playlist"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Weekend specials"
          />
        </div>
        <Button type="submit" disabled={pending}>
          Create
        </Button>
      </form>

      {selected ? (
        <div className="flex flex-wrap items-end gap-2">
          <RenamePlaylistRow
            key={selected.id}
            playlist={selected}
            pending={pending}
            run={startTransition}
            onRefresh={() => router.refresh()}
          />
        </div>
      ) : null}

      {selected ? (
        <>
          <form
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!file) {
                toast.error("Choose an image or video.");
                return;
              }
              startTransition(async () => {
                const result = await uploadScreenAdFromBrowser({
                  file,
                  venueId,
                  title,
                  duration,
                  transition,
                  sortOrder: items.length,
                  playlistId: selected.id,
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
              <Label htmlFor="playlist-file">Add media to this playlist</Label>
              <input
                id="playlist-file"
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
              <Label htmlFor="playlist-media-title">Title</Label>
              <Input
                id="playlist-media-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Happy Hour"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playlist-media-duration">Seconds on screen</Label>
              <Input
                id="playlist-media-duration"
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playlist-media-transition">Transition</Label>
              <select
                id="playlist-media-transition"
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
                {pending ? "Uploading…" : "Add media"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || items.some((item) => item.source_kind === "week_events")}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addPlaylistWeekEventsAction({ playlistId: selected.id });
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

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
              This playlist is empty. Upload media, add a special, or add this week’s events.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, index) => (
                <PlaylistItemRow
                  key={item.id}
                  item={item}
                  canUp={index > 0}
                  canDown={index < items.length - 1}
                  ids={items.map((entry) => entry.id)}
                  pending={pending}
                  onRefresh={() => router.refresh()}
                  run={startTransition}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          Create a playlist to start sequencing screen media.
        </p>
      )}
    </section>
  );
}

function RenamePlaylistRow({
  playlist,
  pending,
  run,
  onRefresh,
}: {
  playlist: StaffScreenPlaylist;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(playlist.name);
  return (
    <>
      <div className="min-w-[200px] flex-1 space-y-2">
        <Label htmlFor="rename-playlist">Rename playlist</Label>
        <Input id="rename-playlist" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending || !name.trim()}
        onClick={() =>
          run(async () => {
            const result = await renameScreenPlaylistAction({ id: playlist.id, name });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              onRefresh();
            }
          })
        }
      >
        Rename
      </Button>
    </>
  );
}

function PlaylistItemRow({
  item,
  canUp,
  canDown,
  ids,
  pending,
  onRefresh,
  run,
}: {
  item: StaffPlaylistItem;
  canUp: boolean;
  canDown: boolean;
  ids: string[];
  pending: boolean;
  onRefresh: () => void;
  run: (fn: () => Promise<void>) => void;
}) {
  const [duration, setDuration] = useState(item.duration_seconds ? String(item.duration_seconds) : "");
  const [transition, setTransition] = useState<ScreenTransition>(item.transition);
  const [enabled, setEnabled] = useState(item.enabled);

  function move(direction: -1 | 1) {
    const next = [...ids];
    const index = next.indexOf(item.id);
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    run(async () => {
      const result = await reorderPlaylistItemsAction({ playlistId: item.playlist_id, ids: next });
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
        {item.source_kind === "week_events" ? (
          <div className="flex h-24 w-full items-center justify-center bg-[#1b1612] px-2 text-center text-xs text-[#e4c4b0]">
            This week
          </div>
        ) : item.media_kind === "video" ? (
          <video src={item.public_url} muted className="h-24 w-full object-cover" />
        ) : item.public_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.public_url} alt="" className="h-24 w-full object-cover" />
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">No preview</div>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <p className="font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.preview_label}</p>
        </div>
        <Input
          type="number"
          min={1}
          max={600}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          aria-label="Duration seconds"
          placeholder={item.media_kind === "video" ? "Full video" : item.source_kind === "week_events" ? "20" : "10"}
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
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
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
                const result = await updatePlaylistItemAction({
                  id: item.id,
                  durationSeconds: duration ? Number(duration) : null,
                  transition,
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
                const result = await archivePlaylistItemAction(item.id);
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
