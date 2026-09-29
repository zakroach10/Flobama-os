import { createLedMediaSceneAction } from "@/actions/led-wall";
import type { PublicSupabaseEnv } from "@/lib/env";
import { LED_WALL_SQL } from "@/lib/constants";
import { ledMediaKindForFile } from "@/lib/screens/led-wall";
import { describeStorageSizeFailure, MAX_SCREEN_AD_BYTES, screenAdTooLargeMessage } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Upload } from "tus-js-client";

const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;

function describeLedUploadFailure(message: string) {
  const sizeLimited = describeStorageSizeFailure(message);
  if (sizeLimited) return sizeLimited;
  if (/bucket not found|not found|row-level security|violates/i.test(message)) {
    return `${message} Apply ${LED_WALL_SQL} if the LED wall tables are missing. Uploads use the screen-ads bucket from supabase/migrations/20260908000005_screens.sql.`;
  }
  return message;
}

function resumableEndpoint(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  if (url.hostname.endsWith(".supabase.co")) {
    const projectId = url.hostname.slice(0, -".supabase.co".length);
    return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
}

function uploadInChunks(input: {
  endpoint: string;
  accessToken: string;
  file: File;
  objectName: string;
  contentType: string;
  onProgress?: (loaded: number, total: number) => void;
  onStatus?: (message: string) => void;
}) {
  return new Promise<string>((resolve, reject) => {
    let lastPaint = 0;
    let objectName = input.objectName;
    const upload = new Upload(input.file, {
      endpoint: input.endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "screen-ads",
        objectName: input.objectName,
        contentType: input.contentType,
        cacheControl: "3600",
      },
      chunkSize: RESUMABLE_CHUNK_BYTES,
      onError(error) {
        reject(error instanceof Error ? error : new Error("Upload failed."));
      },
      onProgress(loaded, total) {
        const now = Date.now();
        if (loaded !== total && now - lastPaint < 200) return;
        lastPaint = now;
        input.onProgress?.(loaded, total);
      },
      onSuccess() {
        resolve(objectName);
      },
    });

    void upload
      .findPreviousUploads()
      .then((previous) => {
        const resumable = previous.find((item) => item.metadata.bucketName === "screen-ads" && item.metadata.objectName);
        if (resumable?.metadata.objectName) {
          upload.resumeFromPreviousUpload(resumable);
          objectName = resumable.metadata.objectName;
          input.onStatus?.("Resuming upload…");
        } else {
          input.onStatus?.("Starting upload…");
        }
        upload.start();
      })
      .catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error("Upload failed."));
      });
  });
}

export async function uploadLedMediaFromBrowser(input: {
  file: File;
  venueId: string;
  title: string;
  supabaseEnv: PublicSupabaseEnv | null;
  rollsUntilShowtime?: boolean;
  onProgress?: (loaded: number, total: number) => void;
  onStatus?: (message: string) => void;
}) {
  const mediaKind = ledMediaKindForFile(input.file);
  if (!mediaKind) return { ok: false as const, message: "Use an MP4 loop or a PNG." };
  if (input.file.size === 0) return { ok: false as const, message: "Choose an MP4 or PNG file." };
  if (input.file.size > MAX_SCREEN_AD_BYTES) return { ok: false as const, message: screenAdTooLargeMessage() };

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false as const,
      message:
        "The public Supabase URL and anon key are missing from this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken || !input.supabaseEnv) {
    return { ok: false as const, message: "Sign in again before uploading." };
  }

  const title = input.title.trim() || input.file.name.replace(/\.[^.]+$/, "");
  const id = crypto.randomUUID();
  const ext = mediaKind === "video" ? "mp4" : "png";
  const contentType = mediaKind === "video" ? "video/mp4" : "image/png";
  let storagePath = `${input.venueId}/led/${id}.${ext}`;

  try {
    storagePath = await uploadInChunks({
      endpoint: resumableEndpoint(input.supabaseEnv.url),
      accessToken,
      file: input.file,
      objectName: storagePath,
      contentType,
      onProgress: input.onProgress,
      onStatus: input.onStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return { ok: false as const, message: describeLedUploadFailure(message) };
  }

  input.onStatus?.("Saving the configuration…");
  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const sceneId = storagePath.split("/").pop()?.replace(/\.[^.]+$/, "") || id;
  const result = await createLedMediaSceneAction({
    id: sceneId,
    title,
    mediaKind,
    storagePath,
    publicUrl,
    rollsUntilShowtime: mediaKind === "video" && input.rollsUntilShowtime === true,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false as const, message: describeLedUploadFailure(result.message) };
  }
  return { ok: true as const, message: result.message, id: sceneId };
}
