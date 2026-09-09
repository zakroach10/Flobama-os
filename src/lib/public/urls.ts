export const PRODUCTION_SITE_URL = "https://flobama-os.vercel.app";

export function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

export function joinPublicUrl(origin: string, path: string): string {
  const base = normalizeOrigin(origin) ?? origin.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function buildPublicSurfaceUrls(origin: string) {
  const base = normalizeOrigin(origin) ?? PRODUCTION_SITE_URL;
  const embed = joinPublicUrl(base, "/embed/events");
  const embedScript = joinPublicUrl(base, "/embed/events.js");
  const overlay = joinPublicUrl(base, "/overlay");
  const eventsApi = joinPublicUrl(base, "/api/public/v1/events");
  const nowApi = joinPublicUrl(base, "/api/public/v1/now");
  const verticalDisplay = joinPublicUrl(base, "/display/vertical");
  const verticalApi = joinPublicUrl(base, "/api/public/v1/screens/vertical");
  const weekApi = joinPublicUrl(base, "/api/public/v1/screens/week");
  const weekFlyer = joinPublicUrl(base, "/print/week");
  const iframe = `<iframe src="${embed}" title="FloBama events" style="width:100%;min-height:640px;border:0"></iframe>`;
  const embedSnippet = `${iframe}\n<script src="${embedScript}" defer></script>`;
  return {
    origin: base,
    embed,
    embedScript,
    overlay,
    eventsApi,
    nowApi,
    verticalDisplay,
    verticalApi,
    weekApi,
    weekFlyer,
    embedSnippet,
  };
}
