import { customerOptions, customerJson } from "@/lib/customer/http";
import { loadCustomerCatalog } from "@/lib/customer/catalog";
import { getLiveState, muxEnvFromProcess } from "@/lib/customer/stream";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET() {
  const [catalog, live] = await Promise.all([loadCustomerCatalog(), getLiveState(muxEnvFromProcess())]);
  if (catalog.error) {
    return customerJson(
      { error: catalog.missing ? "Apply the customer app migration before using this API." : catalog.error },
      catalog.missing ? 503 : 500,
    );
  }
  const now = new Date().toISOString();
  const upcoming = catalog.catalog.shows.filter((show) => show.endsAt > now);
  const tonight = upcoming[0] ?? null;
  return customerJson({
    sample: catalog.sample,
    live,
    tonight,
    upcoming: upcoming.slice(0, 6),
    specials: catalog.catalog.specials,
  });
}
