"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  issueServerStationUploadSessionAction,
  listServerStationUploadLibraryAction,
  pollServerStationUploadSessionAction,
  prepareServerStationGraphicUploadAction,
  removeServerStationUploadLibraryItemAction,
  saveServerStationUploadToLibraryAction,
  setUploadLibraryItemOnWallAction,
} from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import { StationLink } from "@/components/server-station/station-nav";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import type { ServerStationUploadLibraryItem } from "@/lib/server-station/upload-library";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PublicSupabaseEnv } from "@/lib/env";
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
  const [library, setLibrary] = useState<ServerStationUploadLibraryItem[]>([]);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reloadLibrary() {
    startTransition(async () => {
      const result = await listServerStationUploadLibraryAction();
      if (!result.ok) {
        setLibraryMessage(result.message);
        return;
      }
      setLibraryMessage(null);
      setLibrary(result.items);
    });
  }

  useEffect(() => {
    reloadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => {
      void (async () => {
        const result = await pollServerStationUploadSessionAction({ sessionId });
        if (result.ok && result.uploaded && result.url) {
          setSessionId(null);
          setQrDataUrl(null);
          toast.success("Upload received — saved to tonight’s temporary library.");
          reloadLibrary();
        }
      })();
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function uploadLocalPhotoToLibrary(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a photo.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be 10 MB or smaller.");
      return;
    }
    const supabase = createBrowserSupabaseClient(supabaseEnv);
    if (!supabase) {
      toast.error("Upload is not configured.");
      return;
    }
    const contentType =
      file.type === "image/webp" ? "image/webp" : file.type === "image/png" ? "image/png" : "image/jpeg";
    const prepared = await prepareServerStationGraphicUploadAction({
      prefix: "server-upload",
      contentType,
    });
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
    let contentHash: string | null = null;
    try {
      const { sha256HexFromBlob } = await import("@/lib/display-devices/hashes");
      contentHash = await sha256HexFromBlob(file);
    } catch {
      contentHash = null;
    }
    const saved = await saveServerStationUploadToLibraryAction({
      title: file.name.replace(/\.[^.]+$/, "") || "Phone upload",
      publicUrl: prepared.publicUrl,
      storagePath: prepared.storagePath,
      mediaKind: "image",
      contentHash,
    });
    setMessage(saved.message);
    if (saved.ok) {
      toast.success(saved.message);
      reloadLibrary();
    } else {
      toast.error(saved.message);
    }
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="Upload from Phone">
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">Temporary upload library</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          Guest QR uploads land here for tonight. Set on Wall puts one on the LED — they are not added to the
          house ad rotation unless you choose that elsewhere.
        </p>
      </div>

      {message ? (
        <p className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
          {message}
        </p>
      ) : null}
      {libraryMessage ? (
        <p className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-50">
          {libraryMessage}
        </p>
      ) : null}

      <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="space-y-4 text-center lg:text-left">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (!file) return;
              startTransition(async () => {
                await uploadLocalPhotoToLibrary(file);
              });
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
                const dataUrl = await QRCode.toDataURL(result.uploadUrl, {
                  width: 640,
                  margin: 1,
                  color: { dark: "#1a1410", light: "#ffffff" },
                });
                setQrDataUrl(dataUrl);
                toast.success(result.message);
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
              <p className="mt-2 text-sm text-[#5c4a3d]">
                {sessionId ? "Waiting for upload…" : "Ready"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#f7efe6]">Tonight’s library</h2>
              <p className="text-sm text-[#e8d5c4]/80">
                Clears after close. Live takes are managed in{" "}
                <StationLink href="/server/active" className="font-semibold underline">
                  Your rotation
                </StationLink>
                .
              </p>
            </div>
            <ServerStationButton
              variant="secondary"
              disabled={pending}
              onClick={() => reloadLibrary()}
              className="min-h-11 px-4 text-sm"
            >
              Refresh
            </ServerStationButton>
          </div>

          {library.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-6 text-[#e8d5c4]">
              No phone uploads yet tonight. Show a QR or choose a photo to add one.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {library.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.publicUrl}
                    alt=""
                    className="aspect-video w-full bg-black/40 object-contain"
                  />
                  <div className="space-y-2 p-3">
                    <p className="truncate text-sm font-semibold text-[#f7efe6]">{item.title}</p>
                    <p className="text-xs text-[#e8d5c4]/80">
                      {item.lastSetOnWallAt ? "Previously set on wall · " : ""}
                      expires tonight
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ServerStationButton
                        type="button"
                        disabled={pending}
                        className="min-h-11 px-4 text-sm"
                        onClick={() => {
                          startTransition(async () => {
                            const result = await setUploadLibraryItemOnWallAction({
                              itemId: item.id,
                              title: item.title,
                              durationPreset: 15,
                            });
                            setMessage(result.message);
                            if (result.ok) {
                              toast.success(result.message);
                              reloadLibrary();
                            } else {
                              toast.error(result.message);
                            }
                          });
                        }}
                      >
                        Set on Wall
                      </ServerStationButton>
                      <ServerStationButton
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        className="min-h-11 px-4 text-sm"
                        onClick={() => {
                          startTransition(async () => {
                            const result = await removeServerStationUploadLibraryItemAction({
                              itemId: item.id,
                            });
                            setMessage(result.message);
                            if (result.ok) {
                              toast.success(result.message);
                              reloadLibrary();
                            } else {
                              toast.error(result.message);
                            }
                          });
                        }}
                      >
                        Remove
                      </ServerStationButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p
        className={cn(
          "rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#e8d5c4]",
        )}
      >
        Set on Wall waits for the current ad to finish, then takes over the LED. It does not insert the
        photo into the ongoing house ad rotation.
      </p>
    </ServerStationShell>
  );
}
