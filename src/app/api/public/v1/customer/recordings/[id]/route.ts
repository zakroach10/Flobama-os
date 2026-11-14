import { customerJson, customerOptions } from "@/lib/customer/http";
import { loadCustomerCatalog } from "@/lib/customer/catalog";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const loaded = await loadCustomerCatalog();
  if (loaded.error) return customerJson({ error: loaded.error }, loaded.missing ? 503 : 500);
  const recording = loaded.catalog.recordings.find((row) => row.id === id);
  if (!recording) return customerJson({ error: "Recording not found." }, 404);
  return customerJson({ sample: loaded.sample, recording });
}
