import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listEvents, artistNames } from "@/lib/queries/events";
import { parseEventListFilters } from "@/lib/queries/filters";
import { EVENT_PAGE_SIZE, EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from "@/lib/constants";
import { formatVenueDateTime } from "@/lib/timezone";
import { canManageProgramming } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/states";
import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { ImportLegacyButton } from "@/components/events/import-legacy-button";
import { ExportWeekSocialButton } from "@/components/print/export-week-social-button";
import { PrintWeekFlyerButton } from "@/components/print/print-week-flyer-button";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const params = await searchParams;
  const filters = parseEventListFilters(params, EVENT_PAGE_SIZE, context.venue.timezone);
  const { events, count, error } = await listEvents(
    supabase,
    context.venue.id,
    filters,
    new Date().toISOString(),
  );
  const totalPages = Math.max(1, Math.ceil(count / EVENT_PAGE_SIZE));
  const window = filters.window;
  const q = typeof params.q === "string" ? params.q : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Events</h1>
          <p className="text-muted-foreground">Operational calendar for {context.venue.name}.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PrintWeekFlyerButton />
          <ExportWeekSocialButton />
          {canManageProgramming(context.role) ? (
            <>
              <ImportLegacyButton />
              <Button className="w-full sm:w-auto" render={<Link href="/programming/new" />}>
                Add event
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-6" method="get">
        <Input name="q" defaultValue={q} placeholder="Search title or artist" className="md:col-span-2" aria-label="Search events" />
        <select name="window" defaultValue={window} className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm" aria-label="Event window">
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="cancelled">Cancelled</option>
          <option value="archived">Archived</option>
        </select>
        <select name="status" defaultValue={filters.status} className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm" aria-label="Status">
          <option value="all">All statuses</option>
          {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="eventType" defaultValue={filters.eventType} className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm" aria-label="Event type">
          <option value="all">All types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <div className="grid gap-3 md:col-span-6 md:grid-cols-2">
          <label className="text-sm">
            From
            <Input type="date" name="from" defaultValue={filters.fromDate ?? ""} className="mt-1" />
          </label>
          <label className="text-sm">
            To
            <Input type="date" name="to" defaultValue={filters.toDate ?? ""} className="mt-1" />
          </label>
        </div>
      </form>

      {error ? (
        <ErrorState title="Could not load events" description={error} />
      ) : events.length === 0 ? (
        q || filters.status !== "all" || filters.eventType !== "all" || filters.fromDate || filters.toDate || window !== "upcoming" ? (
          <EmptyState title="No matching events" description="Nothing matches these filters. Clear search or switch windows." />
        ) : (
          <EmptyState
            title="No upcoming events"
            description="Create the first show to start the operational calendar."
            actionHref={canManageProgramming(context.role) ? "/programming/new" : undefined}
            actionLabel={canManageProgramming(context.role) ? "Add event" : undefined}
          />
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Artists</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatVenueDateTime(event.starts_at, context.venue.timezone)}
                    </td>
                    <td className="px-4 py-3">
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/programming/${event.id}`}>
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {artistNames(event).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={event.event_type} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl border bg-card p-4">
                <Link href={`/programming/${event.id}`} className="block space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{event.title}</p>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatVenueDateTime(event.starts_at, context.venue.timezone)}
                  </p>
                  <p className="text-sm">{artistNames(event).join(", ") || "No artists attached"}</p>
                  <TypeBadge type={event.event_type} />
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <Pagination page={filters.page} totalPages={totalPages} params={params} />
          ) : null}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | string[] | undefined>;
}) {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    query[key] = Array.isArray(value) ? value[0] : value;
  }
  const prev = new URLSearchParams(query);
  const next = new URLSearchParams(query);
  prev.set("page", String(Math.max(1, page - 1)));
  next.set("page", String(Math.min(totalPages, page + 1)));
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" disabled={page <= 1} render={<Link href={`/programming?${prev.toString()}`} />}>
        Previous
      </Button>
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <Button variant="outline" disabled={page >= totalPages} render={<Link href={`/programming?${next.toString()}`} />}>
        Next
      </Button>
    </div>
  );
}
