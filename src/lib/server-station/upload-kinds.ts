const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO = new Set(["video/mp4", "video/webm"]);

export function detectServerStationUploadKind(file: { type: string; name: string }) {
  const type = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ALLOWED_IMAGE.has(type) || ["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
    return "image" as const;
  }
  if (ALLOWED_VIDEO.has(type) || ["mp4", "webm"].includes(ext ?? "")) {
    return "video" as const;
  }
  return null;
}
