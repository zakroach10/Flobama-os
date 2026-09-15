import { BookingRecordPage } from "@/components/booking/booking-record-page";

export const dynamic = "force-dynamic";

export default async function PrivateEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingRecordPage kind="private_events" recordId={id} />;
}
