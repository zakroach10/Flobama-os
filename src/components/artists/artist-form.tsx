"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveArtistAction, saveArtistAction } from "@/actions/records";
import { assignArtistLedWallAction } from "@/actions/led-wall";
import { checkDuplicateArtistNameAction } from "@/actions/artists-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArtistRow } from "@/lib/queries/artists";

export function ArtistForm({
  artist,
  canEdit,
  ledScenes = [],
  canAssignLed = false,
}: {
  artist?: ArtistRow;
  canEdit: boolean;
  ledScenes?: { id: string; title: string; enabled: boolean }[];
  canAssignLed?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(artist?.name ?? "");
  const [genre, setGenre] = useState(artist?.genre ?? "");
  const [bio, setBio] = useState(artist?.bio ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(artist?.website_url ?? "");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function onNameBlur() {
    if (!name.trim()) return;
    const result = await checkDuplicateArtistNameAction(name, artist?.id);
    if (result.matches.length > 0) {
      setWarning(
        `Another artist is already named “${result.matches[0].name}”. They may still be different performers.`,
      );
    } else {
      setWarning(null);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      const result = await saveArtistAction({ name, genre, bio, websiteUrl }, artist?.id);
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.push(`/artists/${result.id}`);
      router.refresh();
    });
  }

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-4" disabled={!canEdit || pending}>
        <div className="space-y-2">
          <Label htmlFor="artist-name">Name</Label>
          <Input id="artist-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void onNameBlur()} required />
          {warning ? <p className="text-sm text-amber-800">{warning}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist-genre">Genre</Label>
          <Input id="artist-genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist-website">Website URL</Label>
          <Input id="artist-website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist-bio">Bio</Label>
          <Textarea id="artist-bio" className="min-h-28" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
      </fieldset>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : artist ? "Save artist" : "Create artist"}
          </Button>
          {artist && !artist.archived_at ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmArchive(true)}>
              Archive
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your role is read-only.</p>
      )}

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this artist?</DialogTitle>
            <DialogDescription>
              Historical event relationships stay in place. The artist is hidden from new bookings unless you look at archived records.
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!artist) return;
                const result = await archiveArtistAction(artist.id);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(result.message);
                setConfirmArchive(false);
                router.refresh();
              })
            }
          >
            Archive artist
          </Button>
        </DialogContent>
      </Dialog>
    </form>
    {artist ? (
      <ArtistLedAssign
        artistId={artist.id}
        sceneId={artist.led_wall_scene_id}
        scenes={ledScenes}
        canAssign={canAssignLed && !artist.archived_at}
      />
    ) : null}
    </>
  );
}

function ArtistLedAssign({
  artistId,
  sceneId,
  scenes,
  canAssign,
}: {
  artistId: string;
  sceneId: string | null;
  scenes: { id: string; title: string; enabled: boolean }[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(sceneId ?? "");
  const current = scenes.find((scene) => scene.id === sceneId);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">LED wall</h2>
        <p className="text-sm text-muted-foreground">
          {current ? `Configuration: ${current.title}` : "No configuration attached. The wall cannot cut to this artist at showtime."}
        </p>
      </div>
      {canAssign ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await assignArtistLedWallAction({
                artistId,
                sceneId: selected || null,
              });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(result.message);
              router.refresh();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="artist-led-scene">Configuration</Label>
            <select
              id="artist-led-scene"
              className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">No configuration</option>
              {scenes
                .filter((scene) => scene.enabled || scene.id === sceneId)
                .map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title}
                    {scene.enabled ? "" : " (disabled)"}
                  </option>
                ))}
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save LED configuration"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
