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
}: {
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  disabled?: boolean;
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
      width: 280,
      color: { dark: "#1b1612", light: "#f7f1ea" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [uploadUrl]);

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
    <section className="flex min-h-0 flex-col gap-4 rounded-2xl border border-border/70 bg-card/75 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">Upload Scene</h2>
        <p className="text-sm text-muted-foreground">
          Drop an MP4 loop or PNG still onto the LED wall from this computer, or scan a QR to upload from a phone.
        </p>
      </div>

      <form
        className="grid gap-3"
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
        <div className="space-y-2">
          <Label htmlFor="wall-ops-media-title">Title</Label>
          <Input
            id="wall-ops-media-title"
            value={title}
            disabled={disabled || pending}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optional — defaults to the file name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wall-ops-media-file">MP4 or PNG</Label>
          <input
            key={fileKey}
            id="wall-ops-media-file"
            type="file"
            accept="video/mp4,image/png,.mp4,.png"
            disabled={disabled || pending}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            50 MB max ({Math.round(MAX_SCREEN_AD_BYTES / (1024 * 1024))} MB).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-border"
            checked={activateAfter}
            disabled={disabled || pending}
            onChange={(event) => setActivateAfter(event.target.checked)}
          />
          Put on the wall after upload
        </label>
        <Button type="submit" size="lg" className="min-h-12" disabled={disabled || pending || !file}>
          {pending ? "Uploading…" : "Upload scene"}
        </Button>
      </form>

      <div className="border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Phone QR upload
            </h3>
            <p className="text-sm text-muted-foreground">Scan with a phone camera — no staff login on the phone.</p>
          </div>
          <Button
            type="button"
            variant="outline"
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
            {phonePending ? "Creating…" : phoneOpen ? "Hide QR" : "Show phone QR"}
          </Button>
        </div>

        {phoneOpen && uploadUrl ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="mx-auto rounded-xl bg-[#f7f1ea] p-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Phone upload QR code" className="size-44" />
              ) : (
                <div className="flex size-44 items-center justify-center text-xs text-[#1b1612]/70">Building QR…</div>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "in 15 minutes"}. Generate a new QR
                anytime.
              </p>
              <p className={cn("break-all rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-xs")}>
                {uploadUrl}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
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
                <Button type="button" variant="outline" className="text-foreground" disabled={phonePending} onClick={refreshPhoneLink}>
                  {phonePending ? "Refreshing…" : "New QR"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
