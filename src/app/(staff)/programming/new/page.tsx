import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";
import { getEventById } from "@/lib/queries/events";
import { searchActiveArtists } from "@/lib/queries/artists";
import { canManageProgramming } from "@/lib/auth/permissions";
import { DateTime } from "luxon";
import { toVenueDateInput, toVenueTimeInput } from "@/lib/timezone";
import { ErrorState } from "@/components/states";
import type { EventFormInput } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!canManageProgramming(context.role)) redirect("/programming");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const params = await searchParams;
  const { artists } = await searchActiveArtists(supabase, context.venue.id, "");
  const now = DateTime.now().setZone(context.venue.timezone);
  let defaults: EventFormInput = {
    title: "",
    eventType: "live_music",
    startDate: now.toFormat("yyyy-LL-dd"),
    startTime: "20:00",
    endDate: now.toFormat("yyyy-LL-dd"),
    endTime: "23:00",
    locationLabel: "",
    publicDescription: "",
    internalNotes: "",
    status: "draft",
    visibility: "public",
    featured: false,
    isTicketed: false,
    ticketUrl: "",
    coverLabel: "",
    artistIds: [],
    timeZone: context.venue.timezone,
  };
  let isDuplicate = false;

  if (params.from) {
    const { event, error } = await getEventById(supabase, params.from);
    if (error) {
      return <ErrorState title="Could not duplicate" description={error} />;
    }
    if (event && event.venue_id === context.venue.id) {
      isDuplicate = true;
      defaults = {
        title: event.title,
        eventType: event.event_type,
        startDate: toVenueDateInput(event.starts_at, context.venue.timezone),
        startTime: toVenueTimeInput(event.starts_at, context.venue.timezone),
        endDate: toVenueDateInput(event.ends_at, context.venue.timezone),
        endTime: toVenueTimeInput(event.ends_at, context.venue.timezone),
        locationLabel: event.location_label ?? "",
        publicDescription: event.public_description ?? "",
        internalNotes: event.internal_notes ?? "",
        status: "draft",
        visibility: event.visibility,
        featured: false,
        isTicketed: event.is_ticketed,
        ticketUrl: event.ticket_url ?? "",
        coverLabel: event.cover_label ?? "",
        artistIds: event.event_artists.map((row) => row.artist_id),
        timeZone: context.venue.timezone,
        isDuplicateDraft: true,
        datesReviewed: false,
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{isDuplicate ? "Duplicate event" : "New event"}</h1>
        <p className="text-muted-foreground">
          {isDuplicate
            ? "Copied from an existing record. Status is draft until you save."
            : "Schedule a show in the venue timezone."}
        </p>
      </div>
      <EventForm defaultValues={defaults} artists={artists} timeZone={context.venue.timezone} isDuplicate={isDuplicate} />
    </div>
  );
}
