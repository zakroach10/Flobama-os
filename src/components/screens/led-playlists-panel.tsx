"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  activateLedPlaylistAction,
  addLedPlaylistItemAction,
  archiveLedPlaylistAction,
  archiveLedPlaylistItemAction,
  createLedPlaylistAction,
  renameLedPlaylistAction,
  reorderLedPlaylistItemsAction,
  updateLedPlaylistItemAction,
} from "@/actions/led-playlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LED_PLAYLIST_DEFAULT_SECONDS, LED_WALL_PLAYLISTS_SQL } from "@/lib/constants";
import type { LedWallSceneRow } from "@/lib/queries/led-wall";
import { ledSceneDetail } from "@/lib/screens/led-wall";
import type { StaffLedPlaylist, StaffLedPlaylistItem } from "@/lib/screens/led-playlists";

export function LedPlaylistsPanel({
  playlists,
  items,
  scenes,
  selectedPlaylistId,
  activePlaylistId,
  missingTable,
  canConfigure,
}: {
  playlists: StaffLedPlaylist[];
  items: StaffLedPlaylistItem[];
  scenes: LedWallSceneRow[];
  selectedPlaylistId: string | null;
  activePlaylistId: string | null;
  missingTable: boolean;
  canConfigure: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [duration, setDuration] = useState(String(LED_PLAYLIST_DEFAULT_SECONDS));
  const selected = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const addableScenes = scenes.filter((scene) => scene.enabled && scene.kind !== "trivia");

  if (missingTable) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">LED playlists</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">{LED_WALL_PLAYLISTS_SQL}</code> in the Supabase SQL editor to
          rotate media and OBS scenes on the LED wall.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">LED playlists</h2>
        <p className="text-sm text-muted-foreground">
          Sequence media (and OBS scenes) for the LED wall. Activate a playlist to rotate it on{" "}
          <code className="text-xs">/display/led</code>. Trivia stays a one-shot activation.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="led-playlist-select">Playlist</Label>
          <select
            id="led-playlist-select"
            className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={selectedPlaylistId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              router.replace(id ? `/screens?ledPlaylist=${id}` : "/screens", { scroll: false });
            }}
          >
            {playlists.length === 0 ? <option value="">No playlists yet</option> : null}
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
                {playlist.id === activePlaylistId ? " (live)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            disabled={pending || !selected}
            onClick={() =>
              startTransition(async () => {
                if (!selected) return;
                const result = await activateLedPlaylistAction({ playlistId: selected.id });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              })
            }
          >
            {selected?.id === activePlaylistId ? "Restart live" : "Set live on LED"}
          </Button>
          {canConfigure ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || !selected || selected.id === activePlaylistId}
              onClick={() =>
                startTransition(async () => {
                  if (!selected) return;
                  const result = await archiveLedPlaylistAction(selected.id);
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    router.replace("/screens", { scroll: false });
                    router.refresh();
                  }
                })
              }
            >
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      {canConfigure ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await createLedPlaylistAction({ name: name || "LED playlist" });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success(result.message);
                setName("");
                if (result.id) router.replace(`/screens?ledPlaylist=${result.id}`, { scroll: false });
                router.refresh();
              }
            });
          }}
        >
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label htmlFor="new-led-playlist">New playlist</Label>
            <Input
              id="new-led-playlist"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pre-show loop"
            />
          </div>
          <Button type="submit" disabled={pending}>
            Create
          </Button>
        </form>
      ) : null}

      {selected && canConfigure ? (
        <div className="flex flex-wrap items-end gap-2">
          <RenameRow
            key={selected.id}
            playlist={selected}
            pending={pending}
            run={startTransition}
            onRefresh={() => router.refresh()}
          />
        </div>
      ) : null}

      {selected && canConfigure ? (
        <form
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sceneId) {
              toast.error("Choose a scene to add.");
              return;
            }
            startTransition(async () => {
              const result = await addLedPlaylistItemAction({
                playlistId: selected.id,
                sceneId,
                durationSeconds: Number(duration) || LED_PLAYLIST_DEFAULT_SECONDS,
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
            <Label htmlFor="led-playlist-scene">Add scene</Label>
            <select
              id="led-playlist-scene"
              className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
            >
              <option value="">Choose a scene…</option>
              {addableScenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.title} · {ledSceneDetail(scene)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="led-playlist-duration">Seconds on wall</Label>
            <Input
              id="led-playlist-duration"
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Images/OBS use this hold time. Videos advance when the file ends (this value is the OBS sync
              fallback).
            </p>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending || addableScenes.length === 0}>
              Add to playlist
            </Button>
          </div>
        </form>
      ) : null}

      {selected ? (
        items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
            This playlist is empty. Add media or OBS scenes to start rotating.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                canConfigure={canConfigure}
                canUp={index > 0}
                canDown={index < items.length - 1}
                ids={items.map((entry) => entry.id)}
                pending={pending}
                onRefresh={() => router.refresh()}
                run={startTransition}
              />
            ))}
          </ul>
        )
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          Create a playlist to sequence LED wall content.
        </p>
      )}
    </section>
  );
}

function RenameRow({
  playlist,
  pending,
  run,
  onRefresh,
}: {
  playlist: StaffLedPlaylist;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(playlist.name);
  return (
    <>
      <div className="min-w-[200px] flex-1 space-y-2">
        <Label htmlFor="rename-led-playlist">Rename</Label>
        <Input id="rename-led-playlist" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending || !name.trim()}
        onClick={() =>
          run(async () => {
            const result = await renameLedPlaylistAction({ id: playlist.id, name });
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

function ItemRow({
  item,
  canConfigure,
  canUp,
  canDown,
  ids,
  pending,
  onRefresh,
  run,
}: {
  item: StaffLedPlaylistItem;
  canConfigure: boolean;
  canUp: boolean;
  canDown: boolean;
  ids: string[];
  pending: boolean;
  onRefresh: () => void;
  run: (fn: () => Promise<void>) => void;
}) {
  const [duration, setDuration] = useState(String(item.duration_seconds));
  const [enabled, setEnabled] = useState(item.enabled);

  function move(direction: -1 | 1) {
    const next = [...ids];
    const index = next.indexOf(item.id);
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    run(async () => {
      const result = await reorderLedPlaylistItemsAction({ playlistId: item.playlist_id, ids: next });
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
        {item.kind === "media" && item.public_url ? (
          item.media_kind === "video" ? (
            <video src={item.public_url} muted className="h-24 w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.public_url} alt="" className="h-24 w-full object-cover" />
          )
        ) : (
          <div className="flex h-24 items-center justify-center px-2 text-center text-xs text-muted-foreground">
            {item.kind === "obs" ? "OBS" : item.kind}
          </div>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <p className="font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{ledSceneDetail(item)}</p>
        </div>
        {canConfigure ? (
          <>
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
              In rotation
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await updateLedPlaylistItemAction({
                      id: item.id,
                      durationSeconds: Number(duration) || LED_PLAYLIST_DEFAULT_SECONDS,
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
                    const result = await archiveLedPlaylistItemAction(item.id);
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
          </>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">{item.duration_seconds}s · {enabled ? "On" : "Off"}</p>
        )}
      </div>
    </li>
  );
}
