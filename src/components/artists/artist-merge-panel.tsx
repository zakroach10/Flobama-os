"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { mergeArtistsAction } from "@/actions/records";
import { searchArtistsAction } from "@/actions/artists-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ArtistOption = { id: string; name: string; genre?: string | null };

type MergeMode =
  | { kind: "absorb"; other: ArtistOption }
  | { kind: "into"; other: ArtistOption | null };

export function ArtistMergePanel({
  artistId,
  artistName,
  hasLedGraphic,
  suggestedDuplicates,
  canEdit,
}: {
  artistId: string;
  artistName: string;
  hasLedGraphic: boolean;
  suggestedDuplicates: ArtistOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<MergeMode | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistOption[]>([]);
  const [preferredName, setPreferredName] = useState(artistName);
  const [wallFrom, setWallFrom] = useState<"keep" | "merge">("keep");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = mode != null;
  const selectedOther = mode?.other ?? null;

  const keepArtist = useMemo(() => {
    if (!mode || !mode.other) return null;
    if (mode.kind === "absorb") return { id: artistId, name: artistName };
    return mode.other;
  }, [mode, artistId, artistName]);

  const mergeArtist = useMemo(() => {
    if (!mode || !mode.other) return null;
    if (mode.kind === "absorb") return mode.other;
    return { id: artistId, name: artistName };
  }, [mode, artistId, artistName]);

  const suggestions = useMemo(
    () => suggestedDuplicates.filter((row) => row.id !== selectedOther?.id),
    [suggestedDuplicates, selectedOther?.id],
  );

  function resetDialog() {
    setMode(null);
    setQuery("");
    setResults([]);
    setError(null);
    setPreferredName(artistName);
    setWallFrom("keep");
  }

  async function runSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { artists, error: searchError } = await searchArtistsAction(value);
    setSearching(false);
    if (searchError) {
      setError(searchError);
      return;
    }
    setResults(artists.filter((row) => row.id !== artistId));
  }

  function openAbsorb(other: ArtistOption) {
    setMode({ kind: "absorb", other });
    setPreferredName(artistName);
    setWallFrom("keep");
    setError(null);
  }

  function openInto(other?: ArtistOption) {
    setMode({ kind: "into", other: other ?? null });
    setPreferredName(other?.name ?? artistName);
    setWallFrom("keep");
    setError(null);
  }

  function pickIntoTarget(artist: ArtistOption) {
    setMode({ kind: "into", other: artist });
    setPreferredName(artist.name);
    setWallFrom("keep");
    setError(null);
  }

  function onConfirm() {
    if (!keepArtist || !mergeArtist || !canEdit) return;
    setError(null);
    startTransition(async () => {
      const result = await mergeArtistsAction({
        keepArtistId: keepArtist.id,
        mergeArtistId: mergeArtist.id,
        preferredName: preferredName.trim() || keepArtist.name,
        wallFrom,
      });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      resetDialog();
      router.push(`/artists/${keepArtist.id}`);
      router.refresh();
    });
  }

  if (!canEdit) return null;

  const keepLabel = keepArtist?.name ?? "kept artist";
  const mergeLabel = mergeArtist?.name ?? "duplicate";

  return (
    <section className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Merge duplicate</h2>
        <p className="text-sm text-muted-foreground">
          Imports sometimes create both “Band Name” and “Band Name Band”. Merge them so events and the LED
          wall stay on one artist.
        </p>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Possible matches</p>
          <ul className="space-y-2">
            {suggestions.map((dup) => (
              <li
                key={dup.id}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/artists/${dup.id}`} className="font-medium underline-offset-4 hover:underline">
                  {dup.name}
                </Link>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => openAbsorb(dup)}>
                    Absorb into this profile
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openInto(dup)}>
                    Merge this profile into them
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button type="button" variant="outline" onClick={() => openInto()}>
        Merge into another artist…
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) resetDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode?.kind === "absorb" ? `Absorb “${mergeLabel}”` : `Merge “${artistName}”`}
            </DialogTitle>
            <DialogDescription>
              Event bookings and LED wall settings move onto the artist you keep. The other profile is
              archived afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mode?.kind === "into" && !mode.other ? (
              <div className="space-y-2">
                <Label htmlFor="merge-search">Keep this artist</Label>
                <Input
                  id="merge-search"
                  value={query}
                  onChange={(e) => void runSearch(e.target.value)}
                  placeholder="Search artists by name"
                  autoComplete="off"
                />
                {searching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
                {results.length > 0 ? (
                  <ul className="max-h-40 overflow-auto rounded-md border">
                    {results.map((artist) => (
                      <li key={artist.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => pickIntoTarget(artist)}
                        >
                          <span className="font-medium">{artist.name}</span>
                          {artist.genre ? (
                            <span className="text-xs text-muted-foreground">{artist.genre}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {keepArtist && mergeArtist ? (
              <>
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  Keeping <span className="font-semibold">{keepLabel}</span>, archiving{" "}
                  <span className="font-semibold">{mergeLabel}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="merge-preferred-name">Display name after merge</Label>
                  <Input
                    id="merge-preferred-name"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                  />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">LED wall graphic</legend>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={wallFrom === "keep"}
                      onChange={() => setWallFrom("keep")}
                    />
                    <span>
                      Prefer {keepLabel}&apos;s wall config
                      {keepArtist.id === artistId && !hasLedGraphic
                        ? " (none here yet — the duplicate’s graphic moves over if present)"
                        : ""}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={wallFrom === "merge"}
                      onChange={() => setWallFrom("merge")}
                      disabled={mergeArtist.id === artistId && !hasLedGraphic}
                    />
                    <span>
                      Prefer {mergeLabel}&apos;s wall config
                      {mergeArtist.id === artistId && !hasLedGraphic
                        ? " (unavailable — no graphic on this profile)"
                        : ""}
                    </span>
                  </label>
                </fieldset>
              </>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!keepArtist || !mergeArtist || pending} onClick={onConfirm}>
                {pending ? "Merging…" : "Merge artists"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={resetDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
