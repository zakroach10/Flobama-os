import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/customer/menu", label: "Menu" },
  { href: "/customer/merch", label: "Merch" },
  { href: "/customer/orders", label: "Orders" },
  { href: "/customer/recordings", label: "Recordings" },
  { href: "/customer/stream", label: "Live stream" },
];

export function CustomerSubnav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CustomerMigrationNotice() {
  return (
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      Apply <code>supabase/migrations/20261114000070_customer_app.sql</code> before this section can load. This
      change does not apply that migration to production.
    </p>
  );
}
