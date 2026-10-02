import Link from "next/link";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/queries/dashboard";
import { artistNames } from "@/lib/queries/events";
import { getLedWallAgentStatus, getLedWallRuntime, listLedWallScenes } from "@/lib/queries/led-wall";
import { formatVenueDateTime, formatVenueTime, formatVenueTodayHeading } from "@/lib/timezone";
import { canConfigureLedWall, canManageProgramming } from "@/lib/auth/permissions";
import { LED_WALL_SQL } from "@/lib/constants";
import { describeAgentLink, ledSceneKindLabel } from "@/lib/screens/led-wall";
import { Button } from "@/components/ui/button";
import { LedWallControl } from "@/components/dashboard/led-wall-control";
import { ExportWeekSocialButton } from "@/components/print/export-week-social-button";
import { PrintWeekFlyerButton } from "@/components/print/print-week-flyer-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const [{ data, error }, scenesRes, runtimeRes, agentRes] = await Promise.all([
    loadDashboard(supabase, context.venue.id, context.venue.timezone),
    listLedWallScenes(supabase, context.venue.id),
    getLedWallRuntime(supabase, context.venue.id),
    getLedWallAgentStatus(supabase, context.venue.id),
  ]);
  const ledMissing = scenesRes.missingTable || runtimeRes.missingTable || agentRes.missingTable;
  const ledError = scenesRes.error || runtimeRes.error || agentRes.error;
  const ledScenes = scenesRes.scenes
    .filter((scene) => scene.enabled)
    .map((scene) => ({
      id: scene.id,
      title: scene.title,
      detail: ledSceneKindLabel({
        kind: scene.kind,
        mediaKind: scene.media_kind,
        obsSceneName: scene.obs_scene_name,
      }),
    }));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Venue</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{context.venue.name}</h1>
          <p className="mt-1 text-muted-foreground">{formatVenueTodayHeading(new Date(), context.venue.timezone)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PrintWeekFlyerButton />
          <ExportWeekSocialButton />
          {canManageProgramming(context.role) ? (
            <Button className="w-full sm:w-auto" render={<Link href="/programming/new" />}>
              Add event
            </Button>
          ) : null}
        </div>
      </header>

      {ledMissing ? (
        <ErrorState
          title="LED wall is not set up"
          description={
            canConfigureLedWall(context.role)
              ? `Apply ${LED_WALL_SQL} in the Supabase SQL editor, then reload the dashboard.`
              : "An admin still needs to finish the LED wall setup."
          }
        />
      ) : ledError ? (
        <ErrorState title="Could not load the LED wall" description={ledError} />
      ) : (
        <LedWallControl
          scenes={ledScenes}
          activeSceneId={runtimeRes.runtime?.active_scene_id ?? null}
          status={describeAgentLink(agentRes.agent)}
          setupHref="/screens"
        />
      )}

      {error || !data ? (
        <ErrorState title="Dashboard query failed" description={error ?? "Unknown error"} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Today</h2>
            {data.today.length === 0 ? (
              <EmptyState
                title="Nothing on the floor today"
                description="No events overlap the current venue-local day, including shows that started last night and run past midnight."
                actionHref={canManageProgramming(context.role) ? "/programming/new" : undefined}
                actionLabel={canManageProgramming(context.role) ? "Add event" : undefined}
              />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {data.today.map((event) => (
                  <li key={event.id}>
                    <Link href={`/programming/${event.id}`} className="flex min-h-11 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatVenueTime(event.starts_at, context.venue.timezone)}
                          {artistNames(event).length > 0 ? ` · ${artistNames(event).join(", ")}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              title="Next 7 days"
              value={String(data.nextSevenCount)}
              hint="Non-archived, not cancelled, starting within 7 days"
            />
            <SummaryCard
              title="Upcoming drafts"
              value={String(data.upcomingDraftCount)}
              hint="Draft events that have not ended yet"
            />
            <SummaryCard
              title="Active artists"
              value={String(data.activeArtistCount)}
              hint="Directory records that are not archived"
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Needs attention</h2>
            {data.draftEvents.length === 0 && data.liveMusicMissingArtists.length === 0 ? (
              <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
                No upcoming drafts or live-music events missing artists.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Upcoming drafts</CardTitle>
                    <CardDescription>Publish when the listing is ready. Public + published rows feed the website embed and API.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.draftEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.draftEvents.map((event) => (
                          <li key={event.id}>
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/programming/${event.id}`}>
                              {event.title} · {formatVenueDateTime(event.starts_at, context.venue.timezone)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Live music without artists</CardTitle>
                    <CardDescription>Upcoming live-music events with no directory artists attached.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.liveMusicMissingArtists.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.liveMusicMissingArtists.map((event) => (
                          <li key={event.id}>
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/programming/${event.id}/edit`}>
                              {event.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <Button variant="outline" render={<Link href="/programming" />}>
                Event manager
              </Button>
            </div>
            {data.upcoming.length === 0 ? (
              <EmptyState title="No upcoming events" description="Create the next show to populate this list." />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {data.upcoming.map((event) => (
                  <li key={event.id}>
                    <Link href={`/programming/${event.id}`} className="flex min-h-11 flex-col px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatVenueDateTime(event.starts_at, context.venue.timezone)}
                          {artistNames(event).length > 0 ? ` · ${artistNames(event).join(", ")}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Public listings, embed, and the OBS overlay read only published public events. Internal notes never leave staff screens.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}
