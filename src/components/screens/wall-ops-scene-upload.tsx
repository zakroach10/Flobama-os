"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toast } from "sonner";
import { activateLedWallSceneAction, issueWallLedUploadLinkAction } from "@/actions/led-wall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicSupabaseEnv } from "@/lib/env";
import { uploadLedMediaFromBrowser } from "@/lib/screens/led-upload";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";
import { cn } from "@/lib/utils";

export function WallOpsSceneUpload({
  venueId,
  supabaseEnv,
  disabled = false,
  compact = false,
}: {
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [activateAfter, setActivateAfter] = useState(true);
  const [pending, startTransition] = useTransition();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [phonePending, startPhoneTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    if (!uploadUrl) {
      const clearId = setTimeout(() => {
        if (!cancelled) setQrDataUrl(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(clearId);
      };
    }
    void QRCode.toDataURL(uploadUrl, {
      margin: 1,
      width: compact ? 200 : 280,
      color: { dark: "#1b1612", light: "#f7f1ea" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [compact, uploadUrl]);

  function refreshPhoneLink() {
    startPhoneTransition(async () => {
      const result = await issueWallLedUploadLinkAction();
      if (!result.ok || !result.uploadUrl) {
        toast.error(result.message);
        return;
      }
      setUploadUrl(result.uploadUrl);
      setExpiresAt(result.expiresAt ?? null);
      setPhoneOpen(true);
      toast.success(result.message);
    });
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/75",
        compact ? "gap-2 p-3" : "gap-4 p-4 sm:p-5",
      )}
    >
      <div className="shrink-0">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Upload Scene</h2>
        <p className="text-xs text-muted-foreground">MP4 loop or PNG still · phone QR available</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled) return;
            if (!file) {
              toast.error("Choose an MP4 or PNG.");
              return;
            }
            startTransition(async () => {
              const result = await uploadLedMediaFromBrowser({
                file,
                venueId,
                title,
                supabaseEnv,
              });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(result.message);
              if (activateAfter && result.id) {
                const activated = await activateLedWallSceneAction({ sceneId: result.id });
                if (!activated.ok) toast.error(activated.message);
                else toast.success(activated.message);
              }
              setTitle("");
              setFile(null);
              setFileKey((value) => value + 1);
              router.refresh();
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="wall-ops-media-title" className="text-xs">
              Title
            </Label>
            <Input
              id="wall-ops-media-title"
              value={title}
              disabled={disabled || pending}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional file name"
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wall-ops-media-file" className="text-xs">
              MP4 or PNG
            </Label>
            <input
              key={fileKey}
              id="wall-ops-media-file"
              type="file"
              accept="video/mp4,image/png,.mp4,.png"
              disabled={disabled || pending}
              className="block w-full text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-secondary-foreground"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-muted-foreground">
              {Math.round(MAX_SCREEN_AD_BYTES / (1024 * 1024))} MB max
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={activateAfter}
              disabled={disabled || pending}
              onChange={(event) => setActivateAfter(event.target.checked)}
            />
            Put on the wall after upload
          </label>
          <Button type="submit" className="min-h-10" disabled={disabled || pending || !file}>
            {pending ? "Uploading…" : "Upload scene"}
          </Button>
        </form>

        <div className="border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Phone QR
              </h3>
              <p className="text-xs text-muted-foreground">No staff login on the phone</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-foreground"
              disabled={disabled || phonePending}
              onClick={() => {
                if (phoneOpen && uploadUrl) {
                  setPhoneOpen(false);
                  return;
                }
                refreshPhoneLink();
              }}
            >
              {phonePending ? "Creating…" : phoneOpen ? "Hide QR" : "Show QR"}
            </Button>
          </div>

          {phoneOpen && uploadUrl ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <div className="mx-auto rounded-lg bg-[#f7f1ea] p-2">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Phone upload QR code" className={compact ? "size-36" : "size-44"} />
                ) : (
                  <div
                    className={cn(
                      "flex items-center justify-center text-xs text-[#1b1612]/70",
                      compact ? "size-36" : "size-44",
                    )}
                  >
                    Building QR…
                  </div>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">
                  Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "in 15 minutes"}.
                </p>
                <p className={cn("break-all rounded-lg border border-border/70 bg-background/50 px-2 py-1.5 text-[10px]")}>
                  {uploadUrl}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={phonePending}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(uploadUrl);
                        toast.success("Upload link copied.");
                      } catch {
                        toast.error("Could not copy the link.");
                      }
                    }}
                  >
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-foreground"
                    disabled={phonePending}
                    onClick={refreshPhoneLink}
                  >
                    {phonePending ? "Refreshing…" : "New QR"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
