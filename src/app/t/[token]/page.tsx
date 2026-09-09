import { TicketPass } from "@/components/ticketing/ticket-pass";

export const dynamic = "force-dynamic";

export default async function TicketTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TicketPass token={token} />;
}
