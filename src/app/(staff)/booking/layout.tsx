import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canManageProgramming } from "@/lib/auth/permissions";
import { BookingSubnav } from "@/components/booking/booking-subnav";

export const dynamic = "force-dynamic";

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!canManageProgramming(context.role)) redirect("/dashboard");

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
