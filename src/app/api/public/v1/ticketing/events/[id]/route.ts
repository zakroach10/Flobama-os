import { publicJson, publicOptions, PUBLIC_NO_STORE } from "@/lib/public/http";
import { getPublicTicketListing } from "@/lib/ticketing/public-listing";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const listing = await getPublicTicketListing(id);
  if (listing.error || !listing.event) {
    const status = listing.error === "Event not found." ? 404 : listing.error?.includes("not configured") ? 503 : 404;
    return publicJson({ error: listing.error ?? "Event not found.", demo: "/tickets/demo" }, status, PUBLIC_NO_STORE);
  }
  return publicJson(
    {
      event: listing.event,
      types: listing.types,
      tables: listing.tables,
      decor: listing.decor,
      demo: listing.demo,
    },
    200,
    PUBLIC_NO_STORE,
  );
}
