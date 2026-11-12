import { createHash } from "node:crypto";

export function photoBoothClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return `ip:${createHash("sha256").update(ip, "utf8").digest("hex").slice(0, 32)}`;
}
