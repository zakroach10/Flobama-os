import { requireStaffMenu } from "@/lib/auth/require-menu";
import { BookingSubnav } from "@/components/booking/booking-subnav";

export const dynamic = "force-dynamic";

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("booking");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Booking</h1>
        <p className="text-muted-foreground">
          Band submissions and private events from GoHighLevel. GHL stays the system of record.
        </p>
      </header>
      <BookingSubnav />
      {children}
    </div>
  );
}
