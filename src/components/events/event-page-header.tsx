import Link from "next/link";
import type { ReactNode } from "react";
import { EventSectionNav } from "@/components/events/event-section-nav";
import { StatusBadge, TypeBadge } from "@/components/status-badge";

export function EventPageHeader({
  event,
  current,
  actions,
}: {
  event: { id: string; title: string; status: "draft" | "published" | "cancelled"; event_type: string };
  current: "overview" | "ticketing" | "tables" | "sales";
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href="/events" className="underline-offset-4 hover:underline">
          Events
        </Link>
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
          <StatusBadge status={event.status} />
          <TypeBadge type={event.event_type as "live_music" | "karaoke" | "dj" | "sports" | "private_event" | "other"} />
        </div>
        {actions}
      </div>
      <EventSectionNav eventId={event.id} current={current} />
    </div>
  );
}
