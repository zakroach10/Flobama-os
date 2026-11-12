const PRODUCTION_HOSTS = new Set([
  "flobama-os.vercel.app",
  "admin.flobamadowntown.com",
  "www.flobamadowntown.com",
  "flobamadowntown.com",
]);

/**
 * Share links use the host the kiosk is actually on (preview, production, or local).
 * Request Host / X-Forwarded-Host is accepted only when it matches this deployment
 * or a known FloBama host, so a spoofed host cannot put the token on someone else's domain.
 */
export function photoBoothShareOrigin(request: Request, fallback: string, deploymentHost?: string | null): string {
  const allowed = new Set<string>(PRODUCTION_HOSTS);
  const deployment = deploymentHost?.trim().replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
  if (deployment) allowed.add(deployment);
  try {
    allowed.add(new URL(fallback).host.toLowerCase());
  } catch {
    // fallback is returned as-is when the request host is not trusted
  }

  const hostHeader = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (!hostHeader) return fallback;
  const hostname = hostHeader.split(":")[0] ?? "";
  const trusted =
    allowed.has(hostHeader) ||
    allowed.has(hostname) ||
    hostname === "localhost" ||
    hostHeader.startsWith("localhost:");
  if (!trusted) return fallback;
  const proto = hostname === "localhost" ? "http" : "https";
  return `${proto}://${hostHeader}`;
}
