"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearArtistLedMediaAction,
  setArtistLedEnabledAction,
} from "@/actions/artist-led";
import { uploadArtistLedMediaFromBrowser } from "@/lib/screens/artist-led-upload";
import { ARTIST_LED_WALL_SQL } from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";
import type { LedWallSceneRow } from "@/lib/queries/led-wall";
import { ARTIST_LED_AUTO_ROLL_MINUTES } from "@/lib/screens/artist-led";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ArtistLedPanel({
  artistId,
  artistName,
  scene,
  missingColumn,
  canEdit,
  venueId,
  supabaseEnv,
}: {
  artistId: string;
  artistName: string;
  scene: LedWallSceneRow | null;
  missingColumn: boolean;
  canEdit: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  if (missingColumn) {
    return (
      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">LED wall graphic</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">{ARTIST_LED_WALL_SQL}</code> in the Supabase SQL editor to attach a
          logo or loop for this artist.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">LED wall graphic</h2>
        <p className="text-sm text-muted-foreground">
          Upload this artist’s logo or loop here. It auto-rolls on the LED wall {ARTIST_LED_AUTO_ROLL_MINUTES}{" "}
          minutes before showtime, and can be pulled onto today’s schedule from Screens.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-28 items-center justify-center overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-black/10">
          {scene?.public_url ? (
            scene.media_kind === "video" ? (
              <video src={scene.public_url} className="max-h-full max-w-full" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={scene.public_url} alt="" className="max-h-full max-w-full object-contain" />
            )
          ) : (
            <span className="px-3 text-center text-xs text-muted-foreground">No graphic yet</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {scene ? (
            <p className="text-sm">
              {scene.enabled ? "Active configuration" : "Disabled"} ·{" "}
              {scene.media_kind === "video" ? "Video" : "Image"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No LED configuration yet.</p>
          )}
          {canEdit ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="artist-led-file">PNG, JPEG, or HEIC logo, or MP4 loop (2 GB max)</Label>
                <Input
                  key={fileKey}
                  id="artist-led-file"
                  type="file"
                  accept="image/png,image/jpeg,image/heic,image/heif,video/mp4,.png,.jpg,.jpeg,.heic,.heif,.mp4"
                  disabled={pending}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending || !file}
                  onClick={() => {
                    if (!file) return;
                    startTransition(async () => {
                      const result = await uploadArtistLedMediaFromBrowser({
                        file,
                        venueId,
                        artistId,
                        title: artistName,
                        supabaseEnv,
                      });
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        setFile(null);
                        setFileKey((value) => value + 1);
                        router.refresh();
                      }
                    });
                  }}
                >
                  {pending ? "Saving…" : scene ? "Replace graphic" : "Save graphic"}
                </Button>
                {scene ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await setArtistLedEnabledAction({
                            artistId,
                            enabled: !scene.enabled,
                          });
                          if (!result.ok) toast.error(result.message);
                          else {
                            toast.success(result.message);
                            router.refresh();
                          }
                        });
                      }}
                    >
                      {scene.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("Remove this artist’s LED graphic?")) return;
                        startTransition(async () => {
                          const result = await clearArtistLedMediaAction(artistId);
                          if (!result.ok) toast.error(result.message);
                          else {
                            toast.success(result.message);
                            router.refresh();
                          }
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Your role is read-only.</p>
          )}
        </div>
      </div>
    </section>
  );
}
