"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  issueServerStationUploadSessionAction,
  pollServerStationUploadSessionAction,
  prepareServerStationGraphicUploadAction,
  publishServerStationGraphicAction,
} from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import { StationLink } from "@/components/server-station/station-nav";
import { renderServerStationGraphicBlob } from "@/lib/server-station/graphics";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PublicSupabaseEnv } from "@/lib/env";
import { SERVER_STATION_TEMPLATES, type ServerStationTemplateId } from "@/lib/server-station/templates";
import { cn } from "@/lib/utils";

export function ServerStationPhoneUploadPanel({
  actorName,
  wall,
  venueId: _venueId,
  supabaseEnv,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  void _venueId;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<ServerStationTemplateId>(SERVER_STATION_TEMPLATES[0].id);
  const [headline, setHeadline] = useState("FLOBAMA");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localObjectUrlRef = useRef<string | null>(null);

  function chooseLocalPhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a photo.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be 10 MB or smaller.");
      return;
    }
    if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    localObjectUrlRef.current = objectUrl;
    setUploadedUrl(objectUrl);
    setUploadedPath(null);
    setContentHash(null);
    setQrDataUrl(null);
    setSessionId(null);
  }

  async function publishRendered(mode: "show_now" | "add_rotation") {
    if (!uploadedUrl) return;
    const blob = await renderServerStationGraphicBlob({
      kind: "message",
      templateId,
      headline: headline || "FLOBAMA",
      photoUrl: uploadedUrl,
    });
    const supabase = createBrowserSupabaseClient(supabaseEnv);
    if (!supabase) {
      toast.error("Upload is not configured.");
      return;
    }
    const file = new File([blob], `server-upload.png`, { type: "image/png" });
    const prepared = await prepareServerStationGraphicUploadAction({ prefix: "server-upload" });
    if (!prepared.ok) {
      toast.error(prepared.message);
      return;
    }
    const { error } = await supabase.storage
      .from("screen-ads")
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.contentType });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = await publishServerStationGraphicAction({
      kind: "upload",
      title: headline || "Phone upload",
      templateId,
      publicUrl: prepared.publicUrl,
      storagePath: prepared.storagePath,
      contentHash,
      durationPreset: mode === "show_now" ? 15 : "tonight",
      mode,
      photoUrl: prepared.publicUrl,
    });
    setMessage(result.message);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => {
      void (async () => {
        const result = await pollServerStationUploadSessionAction({ sessionId });
        if (result.ok && result.uploaded && result.url) {
          setUploadedUrl(result.url);
          setUploadedPath(result.storagePath ?? null);
          setContentHash(result.contentHash ?? null);
          setSessionId(null);
          toast.success("Upload received. Preview it, then approve.");
        }
      })();
    }, 2000);
    return () => clearInterval(timer);
  }, [sessionId]);

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="Upload from Phone">
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">Upload a picture</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          On a phone, choose a photo from this device. On the kiosk, show a QR code and approve the upload here
          before it goes on the wall.
        </p>
      </div>

      {message ? (
        <p className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
          {message}
        </p>
      ) : null}

      {!uploadedUrl ? (
        <div className="mx-auto max-w-md space-y-5 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => {
              chooseLocalPhoto(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <ServerStationButton disabled={pending} onClick={() => fileInputRef.current?.click()} className="w-full">
            Choose a photo
          </ServerStationButton>
          <ServerStationButton
            variant="secondary"
            disabled={pending}
            className="w-full"
            onClick={() => {
              startTransition(async () => {
                const result = await issueServerStationUploadSessionAction({ workflow: "upload" });
                if (!result.ok || !result.uploadUrl || !result.sessionId) {
                  toast.error(result.message);
                  return;
                }
                setSessionId(result.sessionId);
                setUploadedUrl(null);
                const dataUrl = await QRCode.toDataURL(result.uploadUrl, {
                  width: 640,
                  margin: 1,
                  color: { dark: "#1a1410", light: "#ffffff" },
                });
                setQrDataUrl(dataUrl);
              });
            }}
          >
            {qrDataUrl ? "Make a new QR code" : "Create upload QR code"}
          </ServerStationButton>

          {qrDataUrl ? (
            <div className="rounded-[28px] border border-white/10 bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Phone upload QR" className="mx-auto h-auto w-full max-w-72" />
              <p className="mt-4 text-lg font-semibold text-[#1a1410]">
                Scan with your phone to upload a picture.
              </p>
              <p className="mt-2 text-sm text-[#5c4a3d]">Waiting for upload…</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Uploaded photo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={uploadedUrl} alt="Uploaded" className="max-h-64 w-full rounded-[24px] object-contain" />
            <label className="block space-y-2">
              <span className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Headline</span>
              <input
                className="min-h-16 w-full rounded-2xl border border-white/15 bg-black/30 px-4 text-xl text-[#f7efe6]"
                value={headline}
                maxLength={48}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SERVER_STATION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={cn(
                    "min-h-14 rounded-2xl border px-3 text-left font-semibold",
                    templateId === template.id ? "border-[#d36b4a] bg-[#d36b4a]/20" : "border-white/15",
                  )}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <ServerStationButton
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await publishRendered("show_now");
                  });
                }}
              >
                Show Now
              </ServerStationButton>
              <ServerStationButton
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    if (uploadedPath && uploadedUrl) {
                      const result = await publishServerStationGraphicAction({
                        kind: "upload",
                        title: headline || "Phone upload",
                        templateId,
                        publicUrl: uploadedUrl,
                        storagePath: uploadedPath,
                        contentHash,
                        durationPreset: "tonight",
                        mode: "add_rotation",
                        photoUrl: uploadedUrl,
                      });
                      setMessage(result.message);
                      if (result.ok) toast.success(result.message);
                      else toast.error(result.message);
                      return;
                    }
                    await publishRendered("add_rotation");
                  });
                }}
              >
                Add to Rotation
              </ServerStationButton>
              <ServerStationButton
                variant="secondary"
                onClick={() => {
                  if (localObjectUrlRef.current) {
                    URL.revokeObjectURL(localObjectUrlRef.current);
                    localObjectUrlRef.current = null;
                  }
                  setUploadedUrl(null);
                  setUploadedPath(null);
                  setQrDataUrl(null);
                }}
              >
                Start over
              </ServerStationButton>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Approve before publishing</p>
            <p className="text-[#e8d5c4]">
              Nothing goes on the LED wall until you tap Show Now or Add to Rotation on this kiosk.
              The ad already playing finishes first.{" "}
              <StationLink href="/server/active" className="font-semibold underline">
                Your rotation
              </StationLink>{" "}
              is where you take a slide down.
            </p>
          </div>
        </div>
      )}
    </ServerStationShell>
  );
}
