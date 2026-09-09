import { PublicTicketEventPage } from "@/components/ticketing/public-event-page";
import { getPublicTicketListing } from "@/lib/ticketing/public-listing";
import { DEMO_TICKET_EVENT_ID } from "@/lib/ticketing/demo";

export const dynamic = "force-dynamic";

export default async function TicketEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: rawId } = await params;
  const eventId = rawId === "demo" ? DEMO_TICKET_EVENT_ID : rawId;
  const listing = await getPublicTicketListing(eventId);
  return (
    <PublicTicketEventPage
      eventId={eventId}
      initialEvent={listing.event}
      initialTypes={listing.types}
      initialTables={listing.tables}
      initialDecor={listing.decor}
      initialError={listing.error}
    />
  );
}
