import { BookingRecordPage } from "@/components/booking/booking-record-page";

export const dynamic = "force-dynamic";

export default async function BandSubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingRecordPage kind="band_submission" recordId={id} />;
}
