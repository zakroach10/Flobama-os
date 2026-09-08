export const MAX_SCREEN_AD_BYTES = 50 * 1024 * 1024;

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
  if (/bucket not found|not found|row-level security|violates/i.test(message)) {
    return `${message} Apply supabase/migrations/20260908000005_screens.sql if the screen-ads bucket is missing.`;
  }
  return message;
}
