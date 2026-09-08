const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_?=&.\-]*$/;

export function safeInternalPath(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  const trimmed = candidate.trim();
  if (!SAFE_PATH.test(trimmed)) return fallback;
  if (trimmed.startsWith("//") || trimmed.includes("\\")) return fallback;
  if (trimmed.includes("://")) return fallback;
  return trimmed;
}
