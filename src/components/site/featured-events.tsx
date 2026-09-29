"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PublicEvent = {
  id: string;
  name: string;
  day: string | null;
  date: string | null;
  time: string | null;
  ticketed: boolean;
  ticketUrl: string | null;
  coverCharge: string | null;
};

export function FeaturedEvents({ limit = 8 }: { limit?: number }) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/public/v1/events?limit=${limit}`, { cache: "no-store" });
        const json = (await response.json()) as { events?: PublicEvent[]; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(json.error ?? "Could not load events.");
          setEvents([]);
        } else {
          setEvents(json.events ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load events.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Loading upcoming shows…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button asChild variant="outline">
          <Link href="/embed/events">Open events board</Link>
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No upcoming public events yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40"
        >
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-primary">
            {[event.day, event.date].filter(Boolean).join(" · ")}
          </p>
          <h3 className="mt-2 text-2xl font-heading font-bold uppercase tracking-wider">{event.name}</h3>
          {event.time ? <p className="mt-2 text-sm text-muted-foreground">{event.time}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {event.coverCharge ? (
              <span className="text-xs uppercase tracking-wider text-secondary">{event.coverCharge}</span>
            ) : null}
            {event.ticketed && event.ticketUrl ? (
              <Button asChild size="sm" className="font-heading font-bold uppercase tracking-wider">
                <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
                  Tickets
                </a>
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
