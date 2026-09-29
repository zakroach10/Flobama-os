export const MAX_SCREEN_AD_BYTES = 2 * 1024 * 1024 * 1024;

export function screenAdSizeLimitLabel() {
  const megabytes = MAX_SCREEN_AD_BYTES / (1024 * 1024);
  if (megabytes >= 1024 && megabytes % 1024 === 0) return `${megabytes / 1024} GB`;
  return `${Math.round(megabytes)} MB`;
}

export function screenAdTooLargeMessage() {
  return `File must be ${screenAdSizeLimitLabel()} or smaller.`;
}

export function formatByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes)} B`;
}

export function formatUploadProgress(loaded: number, total: number) {
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return {
    percent,
    label: `Uploading ${percent}% (${formatByteSize(loaded)} of ${formatByteSize(total)})`,
  };
}

export function mediaKindForFile(file: { type: string; name: string }): "image" | "video" | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "webm"].includes(ext)) return "video";
  if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  return null;
}

export function extensionForFile(file: { type: string; name: string }) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/webm") return "webm";
  return null;
}

export function describeUploadFailure(message: string) {
  const sizeLimited = describeStorageSizeFailure(message);
  if (sizeLimited) return sizeLimited;
  if (/bucket not found|not found|row-level security|violates/i.test(message)) {
    return `${message} Apply supabase/migrations/20260908000005_screens.sql if the screen-ads bucket is missing.`;
  }
  return message;
}

export function describeStorageSizeFailure(message: string) {
  if (!/maximum allowed size|maximum size exceeded|payload too large|entity too large/i.test(message)) return null;
  return "Supabase rejected this file because the project is still limited to 50 MB. In the Supabase dashboard, open Storage settings and raise Global file size limit. Free projects cannot go above 50 MB. Then run supabase/migrations/20260928000013_screen_ad_upload_limit.sql so the screen-ads bucket matches.";
}
