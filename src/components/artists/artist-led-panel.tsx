"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearArtistLedMediaAction,
  setArtistLedDefaultAction,
  setArtistLedEnabledAction,
} from "@/actions/artist-led";
import {
  uploadArtistLedMediaFromBrowser,
  type ArtistLedUploadPhase,
} from "@/lib/screens/artist-led-upload";
import { ARTIST_LED_MULTI_VISUALIZER_SQL, ARTIST_LED_WALL_SQL } from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";
import type { LedWallSceneRow } from "@/lib/queries/led-wall";
import { ARTIST_LED_AUTO_ROLL_MINUTES } from "@/lib/screens/artist-led";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type SceneRow = LedWallSceneRow & { is_default?: boolean };

export function ArtistLedPanel({
  artistId,
  artistName,
  scenes,
  missingColumn,
  canEdit,
  venueId,
  supabaseEnv,
}: {
  artistId: string;
  artistName: string;
  scenes: SceneRow[];
  missingColumn: boolean;
  canEdit: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [replaceSceneId, setReplaceSceneId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<ArtistLedUploadPhase | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLoaded, setUploadLoaded] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  const busy = pending || uploading;

  if (missingColumn) {
    return (
      <section className="space-y-2 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">LED wall visualizers</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">{ARTIST_LED_WALL_SQL}</code> (and{" "}
          <code className="text-xs">{ARTIST_LED_MULTI_VISUALIZER_SQL}</code> for multiple visualizers) in the
          Supabase SQL editor to attach logos or loops for this artist.
        </p>
      </section>
    );
  }

  function runUpload(sceneId?: string) {
    if (!file) return;
    setUploading(true);
    setUploadPhase("uploading");
    setUploadPercent(0);
    setUploadLoaded(0);
    setUploadTotal(file.size);
    void (async () => {
      const result = await uploadArtistLedMediaFromBrowser({
        file,
        venueId,
        artistId,
        title: artistName,
        sceneId,
        supabaseEnv,
        onPhase: setUploadPhase,
        onProgress: (progress) => {
          setUploadPercent(progress.percent);
          setUploadLoaded(progress.loaded);
          setUploadTotal(progress.total);
        },
      });
      setUploading(false);
      setUploadPhase(null);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        setFile(null);
        setFileKey((value) => value + 1);
        setReplaceSceneId(null);
        router.refresh();
      }
    })();
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">LED wall visualizers</h2>
        <p className="text-sm text-muted-foreground">
          Keep multiple logos or loops on file. Auto-roll uses the default {ARTIST_LED_AUTO_ROLL_MINUTES} minutes before
          showtime; Screens / Wall Ops can pick any visualizer at showtime.
        </p>
      </div>

      {scenes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No LED visualizers yet.</p>
      ) : (
        <ul className="space-y-3">
          {scenes.map((scene) => {
            const isDefault = Boolean(scene.is_default);
            return (
              <li
                key={scene.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-black/10">
                  {scene.public_url ? (
                    scene.media_kind === "video" ? (
                      <video src={scene.public_url} className="max-h-full max-w-full" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={scene.public_url} alt="" className="max-h-full max-w-full object-contain" />
                    )
                  ) : (
                    <span className="px-2 text-center text-xs text-muted-foreground">No media</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {scene.title}
                    {isDefault ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">Default</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {scene.enabled ? "Enabled" : "Disabled"} ·{" "}
                    {scene.media_kind === "video" ? "Video" : "Image"}
                  </p>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!isDefault ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            startTransition(async () => {
                              const result = await setArtistLedDefaultAction({
                                artistId,
                                sceneId: scene.id,
                              });
                              if (!result.ok) toast.error(result.message);
                              else {
                                toast.success(result.message);
                                router.refresh();
                              }
                            });
                          }}
                        >
                          Set default
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await setArtistLedEnabledAction({
                              artistId,
                              sceneId: scene.id,
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
                        size="sm"
                        variant="outline"
                        disabled={busy || !file}
                        onClick={() => {
                          setReplaceSceneId(scene.id);
                          runUpload(scene.id);
                        }}
                      >
                        Replace with selected file
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("Remove this visualizer?")) return;
                          startTransition(async () => {
                            const result = await clearArtistLedMediaAction({
                              artistId,
                              sceneId: scene.id,
                            });
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
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1">
            <Label htmlFor="artist-led-file">Add visualizer — PNG, JPEG, or HEIC logo, or MP4 loop (2 GB max)</Label>
            <Input
              key={fileKey}
              id="artist-led-file"
              type="file"
              accept="image/png,image/jpeg,image/heic,image/heif,video/mp4,.png,.jpg,.jpeg,.heic,.heif,.mp4"
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {uploading ? (
            <div className="space-y-1.5" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {uploadPhase === "saving"
                    ? replaceSceneId
                      ? "Saving replacement…"
                      : "Saving visualizer…"
                    : `Uploading… ${uploadPercent}%`}
                </span>
                {uploadPhase === "uploading" && uploadTotal > 0 ? (
                  <span>
                    {formatBytes(uploadLoaded)} / {formatBytes(uploadTotal)}
                  </span>
                ) : null}
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadPhase === "saving" ? 100 : uploadPercent}
                aria-label="LED wall visualizer upload progress"
              >
                <div
                  className={`h-full rounded-full bg-primary transition-[width] duration-150 ease-out ${
                    uploadPhase === "saving" ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${uploadPhase === "saving" ? 100 : uploadPercent}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !file}
              onClick={() => {
                setReplaceSceneId(null);
                runUpload();
              }}
            >
              {uploading && !replaceSceneId
                ? uploadPhase === "saving"
                  ? "Saving…"
                  : `Uploading ${uploadPercent}%`
                : "Add visualizer"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your role is read-only.</p>
      )}
    </section>
  );
}
