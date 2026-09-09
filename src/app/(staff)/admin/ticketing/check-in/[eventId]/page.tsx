import { redirect } from "next/navigation";

export default async function AdminCheckInAliasPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/ticketing/check-in/${eventId}`);
}
