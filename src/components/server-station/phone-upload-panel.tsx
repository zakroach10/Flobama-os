"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  issueServerStationUploadSessionAction,
  pollServerStationUploadSessionAction,
  publishServerStationGraphicAction,
} from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import { renderServerStationGraphicBlob } from "@/lib/server-station/graphics";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PublicSupabaseEnv } from "@/lib/env";
import { SERVER_STATION_TEMPLATES, type ServerStationTemplateId } from "@/lib/server-station/templates";
import { cn } from "@/lib/utils";

export function ServerStationPhoneUploadPanel({
  actorName,
  wall,
  venueId,
  supabaseEnv,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<ServerStationTemplateId>(SERVER_STATION_TEMPLATES[0].id);
  const [headline, setHeadline] = useState("FLOBAMA");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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
      <div className="mb-5 space-y-2">
        <h1 className="text-3xl font-bold text-[#f7efe6]">Upload Picture From Phone</h1>
        <p className="text-lg text-[#e8d5c4]/90">
          Scan the QR code, upload on your phone, then approve the result on this kiosk before it goes on the wall.
        </p>
      </div>

      {message ? (
        <p className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
          {message}
        </p>
      ) : null}

      {!uploadedUrl ? (
        <div className="mx-auto max-w-md space-y-5 text-center">
          <ServerStationButton
            disabled={pending}
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
              <img src={qrDataUrl} alt="Phone upload QR" className="mx-auto h-72 w-72" />
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
            <img src={uploadedUrl} alt="Uploaded" className="w-full rounded-[24px] object-cover" />
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
            <div className="flex flex-wrap gap-3">
              <ServerStationButton
                disabled={pending || !wall.connected}
                onClick={() => {
                  startTransition(async () => {
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
                    const id = crypto.randomUUID();
                    const storagePath = `${venueId}/led/server-upload-${id}.png`;
                    const file = new File([blob], `server-upload-${id}.png`, { type: "image/png" });
                    const { error } = await supabase.storage.from("screen-ads").upload(storagePath, file, {
                      contentType: "image/png",
                      upsert: false,
                    });
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
                    const result = await publishServerStationGraphicAction({
                      kind: "upload",
                      title: headline || "Phone upload",
                      templateId,
                      publicUrl,
                      storagePath,
                      contentHash,
                      durationPreset: 15,
                      mode: "show_now",
                      photoUrl: uploadedUrl,
                    });
                    setMessage(result.message);
                    if (result.ok) toast.success(result.message);
                    else toast.error(result.message);
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
                    if (!uploadedPath || !uploadedUrl) return;
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
                  });
                }}
              >
                Add to Rotation
              </ServerStationButton>
              <ServerStationButton
                variant="secondary"
                onClick={() => {
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
            </p>
          </div>
        </div>
      )}
    </ServerStationShell>
  );
}
