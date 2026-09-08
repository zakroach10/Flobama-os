import { DateTime } from "luxon";
import { EventsEmbed } from "@/components/embed/events-embed";
import { FLO_BAMA_VENUE_ID, DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { listPublicEvents } from "@/lib/public/queries";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { EmbedHeightReporter } from "@/components/embed/height-reporter";

export const dynamic = "force-dynamic";

export default async function EmbedEventsPage() {
  const client = createAnonSupabaseClient();
  const month = DateTime.now().setZone(DEFAULT_VENUE_TIMEZONE);
  if (!client) {
    return (
      <div className="px-6 py-10 text-center text-sm text-[#c9b8aa]">
        Public listings are not configured.
        <EmbedHeightReporter />
      </div>
    );
  }

  const nowIso = month.toUTC().toISO();
  const [upcoming, monthList] = await Promise.all([
    listPublicEvents(client, {
      venueId: FLO_BAMA_VENUE_ID,
      fromIso: nowIso,
      limit: 80,
      upcomingByEnd: true,
    }),
    listPublicEvents(client, {
      venueId: FLO_BAMA_VENUE_ID,
      fromIso: month.startOf("month").toUTC().toISO(),
      toIso: month.endOf("month").toUTC().toISO(),
      limit: 200,
      upcomingByEnd: false,
    }),
  ]);
  const error = upcoming.error ?? monthList.error;
  const events = upcoming.events;
  const monthEvents = monthList.events;

  if (error) {
    return (
      <div className="px-6 py-10 text-center text-sm text-[#c9b8aa]">
        Could not load events.
        <EmbedHeightReporter />
      </div>
    );
  }

  return (
    <>
      <EventsEmbed events={events} monthEvents={monthEvents} month={month} />
      <EmbedHeightReporter />
    </>
  );
}
