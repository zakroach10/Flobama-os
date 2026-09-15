import { Button } from "@/components/ui/button";
import { toMailtoHref, toTelHref } from "@/lib/ghl/band-inquiry";

export function BookingContactActions({
  email,
  phone,
  bandName,
}: {
  email: string | null;
  phone: string | null;
  bandName?: string | null;
}) {
  if (!email && !phone) return null;
  const subject = bandName ? `FloBama booking — ${bandName}` : "FloBama booking";

  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <Button variant="outline" size="sm" render={<a href={toTelHref(phone)} />}>
          Call
        </Button>
      ) : null}
      {email ? (
        <Button variant="outline" size="sm" render={<a href={toMailtoHref(email, subject)} />}>
          Email
        </Button>
      ) : null}
    </div>
  );
}
