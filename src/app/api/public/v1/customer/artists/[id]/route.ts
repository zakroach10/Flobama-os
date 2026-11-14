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
  const artist = loaded.catalog.artists.find((row) => row.id === id);
  if (!artist) return customerJson({ error: "Artist not found." }, 404);
  const now = new Date().toISOString();
  const shows = loaded.catalog.shows.filter((show) => show.artists.some((row) => row.id === id) && show.endsAt > now);
  const recordings = loaded.catalog.recordings.filter((row) => row.artistId === id);
  return customerJson({ sample: loaded.sample, artist, shows, recordings });
}
