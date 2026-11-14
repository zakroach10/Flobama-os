/**
 * Only surface ticket purchase links that look like real external checkouts.
 * Never treat FloBama OS mock/demo ticketing routes as production purchase.
 */

const MOCK_TICKETING_PATTERNS = [
  /\/tickets(\/|$)/i,
  /\/api\/public\/v1\/ticketing/i,
  /demo-ticketing/i,
  /tickets\/demo/i,
];

export function isVerifiedProductionTicketUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, "https://flobama-os.vercel.app");
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const href = parsed.href;
  if (MOCK_TICKETING_PATTERNS.some((pattern) => pattern.test(href))) {
    return false;
  }

  // Relative /tickets/... paths resolve against FloBama OS — those are mock checkout.
  if (
    parsed.hostname.includes("flobama-os.vercel.app") ||
    parsed.hostname.includes("localhost")
  ) {
    return false;
  }

  return true;
}
