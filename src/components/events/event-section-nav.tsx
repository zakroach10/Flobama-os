import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: (id: string) => `/events/${id}`, label: "Overview" },
  { href: (id: string) => `/events/${id}/ticketing`, label: "Ticketing" },
  { href: (id: string) => `/events/${id}/tables`, label: "Table map" },
  { href: (id: string) => `/events/${id}/sales`, label: "Sales" },
];

export function EventSectionNav({ eventId, current }: { eventId: string; current: "overview" | "ticketing" | "tables" | "sales" }) {
  return (
    <nav
      className="-mx-4 flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      aria-label="Event sections"
    >
      {TABS.map((tab) => {
        const active =
          (current === "overview" && tab.label === "Overview") ||
          (current === "ticketing" && tab.label === "Ticketing") ||
          (current === "tables" && tab.label === "Table map") ||
          (current === "sales" && tab.label === "Sales");
        return (
          <Link
            key={tab.label}
            href={tab.href(eventId)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center px-3 text-sm font-medium",
              active ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
