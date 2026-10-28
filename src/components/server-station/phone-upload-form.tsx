"use client";

import { useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import type { PublicSupabaseEnv } from "@/lib/env";
import { detectServerStationUploadKind } from "@/lib/server-station/upload-kinds";
import { ServerStationButton, serverStationInputClass } from "@/components/server-station/shell";

export function ServerStationPhoneUploadForm({
  token,
  supabaseEnv,
}: {
  token: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        setError(null);
        if (!file) {
          setError("Choose a photo or short video.");
          return;
        }
        const mediaKind = detectServerStationUploadKind(file);
        if (!mediaKind) {
          setError("Use JPG, PNG, WebP, MP4, or WebM.");
          return;
        }
        if (!supabaseEnv) {
          setError("Upload is not configured on this deployment.");
          return;
        }

        startTransition(async () => {
          try {
            const uploadId = crypto.randomUUID();
            const prepareRes = await fetch("/api/public/v1/server-station/upload/prepare", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, mediaKind, uploadId }),
            });
            const prepareJson = (await prepareRes.json()) as {
              error?: string;
              storagePath?: string;
              path?: string;
              token?: string;
              maxBytes?: number;
            };
            if (!prepareRes.ok || !prepareJson.storagePath || !prepareJson.token || !prepareJson.path) {
              setError(prepareJson.error ?? "Could not prepare the upload.");
              return;
            }
            if (prepareJson.maxBytes && file.size > prepareJson.maxBytes) {
              setError(`File must be ${(prepareJson.maxBytes / (1024 * 1024)).toFixed(0)} MB or smaller.`);
              return;
            }

            const supabase = createClient(supabaseEnv.url, supabaseEnv.anonKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const contentType =
              mediaKind === "video"
                ? file.type || "video/mp4"
                : file.type || "image/jpeg";
            const { error: uploadError } = await supabase.storage
              .from("screen-ads")
              .uploadToSignedUrl(prepareJson.path, prepareJson.token, file, { contentType });
            if (uploadError) {
              setError(uploadError.message);
              return;
            }

            let sha256: string | undefined;
            try {
              const { sha256HexFromBlob } = await import("@/lib/display-devices/hashes");
              sha256 = await sha256HexFromBlob(file);
            } catch {
              sha256 = undefined;
            }

            const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(prepareJson.storagePath).data
              .publicUrl;
            const completeRes = await fetch("/api/public/v1/server-station/upload/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                storagePath: prepareJson.storagePath,
                publicUrl,
                mediaKind,
                sha256,
                sizeBytes: file.size,
              }),
            });
            const completeJson = (await completeRes.json()) as { error?: string; message?: string };
            if (!completeRes.ok) {
              setError(completeJson.error ?? "Could not finish the upload.");
              return;
            }
            setMessage(
              completeJson.message ??
                "Upload received. It is in tonight’s temporary library — Set on Wall from the Server Station.",
            );
            setFile(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed.");
          }
        });
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">Photo or short video</span>
        <p className="text-sm text-[#e8d5c4]/90">
          Pick from your camera roll or files. You can still take a new photo from that menu.
        </p>
        <input
          className={serverStationInputClass}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,.jpg,.jpeg,.png,.webp,.mp4,.webm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? <p className="text-sm text-[#f7efe6]">{file.name}</p> : null}
      </label>
      {error ? <p className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-amber-50">{error}</p> : null}
      {message ? (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-emerald-50">{message}</p>
      ) : null}
      <ServerStationButton type="submit" disabled={pending || Boolean(message)}>
        {pending ? "Uploading…" : "Upload"}
      </ServerStationButton>
    </form>
  );
}
