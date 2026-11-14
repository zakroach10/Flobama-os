import { customerJson, customerOptions } from "@/lib/customer/http";
import { loadCustomerCatalog } from "@/lib/customer/catalog";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET() {
  const loaded = await loadCustomerCatalog();
  if (loaded.error) return customerJson({ error: loaded.error }, loaded.missing ? 503 : 500);
  return customerJson({ sample: loaded.sample, recordings: loaded.catalog.recordings });
}
