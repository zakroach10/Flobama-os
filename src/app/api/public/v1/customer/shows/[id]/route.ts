import { customerJson, customerOptions } from "@/lib/customer/http";
import { loadCustomerCatalog } from "@/lib/customer/catalog";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const loaded = await loadCustomerCatalog();
  if (loaded.error) {
    return customerJson({ error: loaded.error }, loaded.missing ? 503 : 500);
  }
  const show = loaded.catalog.shows.find((row) => row.id === id);
  if (!show) return customerJson({ error: "Show not found." }, 404);
  const recordings = loaded.catalog.recordings.filter((row) => row.eventId === id);
  return customerJson({ sample: loaded.sample, show, recordings });
}
