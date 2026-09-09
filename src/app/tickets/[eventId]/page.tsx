import { PublicTicketEventPage } from "@/components/ticketing/public-event-page";

export const dynamic = "force-dynamic";

export default async function TicketEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <PublicTicketEventPage eventId={eventId === "demo" ? "demo-ticketing-event" : eventId} />;
}
