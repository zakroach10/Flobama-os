import { customerJson, customerOptions } from "@/lib/customer/http";
import { loadCustomerCatalog } from "@/lib/customer/catalog";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET(request: Request) {
  const loaded = await loadCustomerCatalog();
  if (loaded.error) {
    return customerJson({ error: loaded.missing ? "Apply the customer app migration." : loaded.error }, loaded.missing ? 503 : 500);
  }
  const past = new URL(request.url).searchParams.get("past") === "1";
  const now = new Date().toISOString();
  const shows = loaded.catalog.shows.filter((show) => (past ? show.endsAt <= now : show.endsAt > now));
  return customerJson({ sample: loaded.sample, shows });
}
