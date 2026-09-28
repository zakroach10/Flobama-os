export const MAX_SCREEN_AD_BYTES = 2 * 1024 * 1024 * 1024;

export function screenAdSizeLimitLabel() {
  const megabytes = MAX_SCREEN_AD_BYTES / (1024 * 1024);
  if (megabytes >= 1024 && megabytes % 1024 === 0) return `${megabytes / 1024} GB`;
  return `${Math.round(megabytes)} MB`;
}

export function screenAdTooLargeMessage() {
  return `File must be ${screenAdSizeLimitLabel()} or smaller.`;
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
  if (!/maximum allowed size|payload too large|entity too large/i.test(message)) return null;
  return `${message} Apply supabase/migrations/20260928000013_screen_ad_upload_limit.sql. If Storage is still capped at 50 MB, raise the project file size limit in the Supabase dashboard as well.`;
}
