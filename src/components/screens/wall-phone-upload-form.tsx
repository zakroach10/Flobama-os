"use client";

import { useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicSupabaseEnv } from "@/lib/env";
import { ledMediaKindForFile } from "@/lib/screens/led-wall";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";

export function WallPhoneUploadForm({
  token,
  supabaseEnv,
}: {
  token: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!file) {
      setError("Choose an MP4 loop or PNG still.");
      return;
    }
    const mediaKind = ledMediaKindForFile(file);
    if (!mediaKind) {
      setError("Use an MP4 loop or a PNG.");
      return;
    }
    if (file.size > MAX_SCREEN_AD_BYTES) {
      setError("File must be 50 MB or smaller.");
      return;
    }
    if (!supabaseEnv) {
      setError("Supabase is not configured on this deployment.");
      return;
    }

    startTransition(async () => {
      try {
        const sceneId = crypto.randomUUID();
        const prepareRes = await fetch("/api/public/v1/wall/upload/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, mediaKind, sceneId }),
        });
        const prepareJson = (await prepareRes.json()) as {
          error?: string;
          storagePath?: string;
          path?: string;
          token?: string;
          signedUrl?: string;
        };
        if (!prepareRes.ok || !prepareJson.storagePath || !prepareJson.token || !prepareJson.path) {
          setError(prepareJson.error ?? "Could not prepare the upload.");
          return;
        }

        const supabase = createClient(supabaseEnv.url, supabaseEnv.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const contentType = mediaKind === "video" ? "video/mp4" : "image/png";
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

        const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(prepareJson.storagePath).data.publicUrl;
        const sceneTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
        const completeRes = await fetch("/api/public/v1/wall/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            sceneId,
            title: sceneTitle,
            mediaKind,
            storagePath: prepareJson.storagePath,
            publicUrl,
            sha256,
            sizeBytes: file.size,
            mediaType: contentType,
          }),
        });
        const completeJson = (await completeRes.json()) as { error?: string; message?: string };
        if (!completeRes.ok) {
          setError(completeJson.error ?? "Could not finish the upload.");
          return;
        }

        setMessage(completeJson.message ?? "Uploaded. It will appear on the wall dashboard.");
        setTitle("");
        setFile(null);
        setFileKey((value) => value + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wall-phone-title">Scene title</Label>
        <Input
          id="wall-phone-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Optional — defaults to the file name"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wall-phone-file">MP4 or PNG</Label>
        <input
          key={fileKey}
          id="wall-phone-file"
          type="file"
          accept="video/mp4,image/png,.mp4,.png,image/*"
          capture="environment"
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">50 MB max. Videos loop on the LED wall.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Uploading…" : "Upload to wall"}
      </Button>
    </form>
  );
}
