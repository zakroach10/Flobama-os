import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { searchActiveArtists } from "@/lib/queries/artists";
import { EventForm } from "@/components/events/event-form";
import { canManageProgramming } from "@/lib/auth/permissions";
import { toVenueDateInput, toVenueTimeInput } from "@/lib/timezone";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!canManageProgramming(context.role)) redirect("/events");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { id } = await params;
  const [{ event, error }, { artists }] = await Promise.all([
    getEventById(supabase, id),
    searchActiveArtists(supabase, context.venue.id, ""),
  ]);
  if (error) return <ErrorState title="Could not load event" description={error} />;
  if (!event || event.venue_id !== context.venue.id) notFound();
  if (event.archived_at) redirect(`/events/${event.id}`);

  const linked = event.event_artists.map((row) => ({
    id: row.artist_id,
    name: row.artists?.name ?? "Artist",
    genre: null,
  }));
  const merged = [...linked, ...artists.filter((artist) => !linked.some((row) => row.id === artist.id))];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit event</h1>
        <p className="text-muted-foreground">{event.title}</p>
      </div>
      <EventForm
        eventId={event.id}
        timeZone={context.venue.timezone}
        artists={merged}
        defaultValues={{
          title: event.title,
          eventType: event.event_type,
          startDate: toVenueDateInput(event.starts_at, context.venue.timezone),
          startTime: toVenueTimeInput(event.starts_at, context.venue.timezone),
          endDate: toVenueDateInput(event.ends_at, context.venue.timezone),
          endTime: toVenueTimeInput(event.ends_at, context.venue.timezone),
          locationLabel: event.location_label ?? "",
          publicDescription: event.public_description ?? "",
          internalNotes: event.internal_notes ?? "",
          status: event.status,
          visibility: event.visibility,
          featured: event.featured,
          artistIds: event.event_artists.map((row) => row.artist_id),
          timeZone: context.venue.timezone,
        }}
      />
    </div>
  );
}
