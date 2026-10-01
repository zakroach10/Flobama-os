import type { PublicSupabaseEnv } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageUploadProgress = {
  /** 0–100 while bytes are transferring. */
  percent: number;
  loaded: number;
  total: number;
};

function encodeObjectPath(bucket: string, path: string) {
  return [bucket, ...path.split("/").filter(Boolean)].map(encodeURIComponent).join("/");
}

function parseXhrErrorMessage(xhr: XMLHttpRequest) {
  try {
    const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string; msg?: string };
    return parsed.message || parsed.error || parsed.msg || xhr.statusText || "Upload failed.";
  } catch {
    return xhr.statusText || "Upload failed.";
  }
}

/** Upload a file to Supabase Storage with byte-level progress via XHR. */
export function uploadStorageObjectWithProgress(input: {
  supabase: SupabaseClient;
  supabaseEnv: PublicSupabaseEnv;
  bucket: string;
  path: string;
  file: Blob;
  contentType: string;
  upsert?: boolean;
  onProgress?: (progress: StorageUploadProgress) => void;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    void (async () => {
      const { data: sessionData, error: sessionError } = await input.supabase.auth.getSession();
      if (sessionError) {
        resolve({ ok: false, message: sessionError.message });
        return;
      }
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        resolve({ ok: false, message: "Sign in required." });
        return;
      }

      const url = `${input.supabaseEnv.url.replace(/\/$/, "")}/storage/v1/object/${encodeObjectPath(
        input.bucket,
        input.path,
      )}`;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.responseType = "text";
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.setRequestHeader("apikey", input.supabaseEnv.anonKey);
      xhr.setRequestHeader("x-upsert", String(Boolean(input.upsert)));
      xhr.setRequestHeader("cache-control", "max-age=3600");
      xhr.setRequestHeader("content-type", input.contentType);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !input.onProgress) return;
        const total = event.total || input.file.size;
        const loaded = event.loaded;
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        input.onProgress({ percent, loaded, total });
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          input.onProgress?.({ percent: 100, loaded: input.file.size, total: input.file.size });
          resolve({ ok: true });
          return;
        }
        resolve({ ok: false, message: parseXhrErrorMessage(xhr) });
      };

      xhr.onerror = () => {
        resolve({ ok: false, message: "Network error while uploading." });
      };

      xhr.onabort = () => {
        resolve({ ok: false, message: "Upload cancelled." });
      };

      input.onProgress?.({ percent: 0, loaded: 0, total: input.file.size });
      xhr.send(input.file);
    })();
  });
}
