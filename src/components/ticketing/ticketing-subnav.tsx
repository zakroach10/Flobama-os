"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/ticketing", label: "Dashboard" },
  { href: "/ticketing/events", label: "Ticketed events" },
  { href: "/ticketing/orders", label: "Orders" },
  { href: "/ticketing/check-in", label: "Check-in" },
  { href: "/ticketing/customers", label: "Customers" },
  { href: "/ticketing/layout", label: "Venue layout" },
  { href: "/ticketing/reports", label: "Reports" },
];

export function TicketingSubnav() {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-4 flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain border-b px-4 pb-px [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      aria-label="Ticketing"
    >
      {LINKS.map((link) => {
        const active = link.href === "/ticketing" ? pathname === "/ticketing" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex h-10 shrink-0 items-center px-3 text-sm font-medium",
              active ? "border-b-2 border-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
