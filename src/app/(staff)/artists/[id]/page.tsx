import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getArtistById, listArtistEvents } from "@/lib/queries/artists";
import { ArtistForm } from "@/components/artists/artist-form";
import { canManageProgramming } from "@/lib/auth/permissions";
import { ErrorState } from "@/components/states";
import { formatVenueDateTime } from "@/lib/timezone";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { id } = await params;
  const { artist, error } = await getArtistById(supabase, id);
  if (error) return <ErrorState title="Could not load artist" description={error} />;
  if (!artist || artist.venue_id !== context.venue.id) notFound();

  const { upcoming, past, error: eventError } = await listArtistEvents(
    supabase,
    context.venue.id,
    artist.id,
    new Date().toISOString(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/artists" className="underline-offset-4 hover:underline">
          Artists
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{artist.name}</h1>
      {artist.archived_at ? <p className="text-sm text-muted-foreground">This artist is archived.</p> : null}
      <ArtistForm artist={artist} canEdit={canManageProgramming(context.role) && !artist.archived_at} />

      {eventError ? (
        <ErrorState title="Could not load linked events" description={eventError} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <EventList title="Upcoming" events={upcoming} timeZone={context.venue.timezone} />
          <EventList title="Past" events={past} timeZone={context.venue.timezone} />
        </div>
      )}
    </div>
  );
}

function EventList({
  title,
  events,
  timeZone,
}: {
  title: string;
  events: { id: string; title: string; starts_at: string; status: "draft" | "published" | "cancelled" }[];
  timeZone: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border bg-card px-3 py-2">
              <Link href={`/events/${event.id}`} className="block">
                <p className="font-medium">{event.title}</p>
                <p className="text-xs text-muted-foreground">{formatVenueDateTime(event.starts_at, timeZone)}</p>
                <StatusBadge status={event.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
