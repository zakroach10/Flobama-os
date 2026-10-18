import Link from "next/link";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/queries/dashboard";
import { artistNames } from "@/lib/queries/events";
import { getLedWallAgentStatus, getLedWallRuntime, listLedWallScenes } from "@/lib/queries/led-wall";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import { formatVenueTime, formatVenueTodayHeading } from "@/lib/timezone";
import { canConfigureLedWall, canManageProgramming, canManageScreensControls } from "@/lib/auth/permissions";
import { LED_WALL_SQL, type EventStatus } from "@/lib/constants";
import { describeLedRunnerLink, freshestLedRunner } from "@/lib/display-devices/types";
import { isAgentStale, ledSceneKindLabel } from "@/lib/screens/led-wall";
import { Button } from "@/components/ui/button";
import { LedWallControl } from "@/components/dashboard/led-wall-control";
import { ExportWeekSocialButton } from "@/components/print/export-week-social-button";
import { PrintWeekFlyerButton } from "@/components/print/print-week-flyer-button";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TODAY_CAP = 5;
const UPCOMING_CAP = 5;
const ATTENTION_CAP = 2;

export default async function DashboardPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const [{ data, error }, scenesRes, runtimeRes, agentRes, devicesRes] = await Promise.all([
    loadDashboard(supabase, context.venue.id, context.venue.timezone),
    listLedWallScenes(supabase, context.venue.id),
    getLedWallRuntime(supabase, context.venue.id),
    getLedWallAgentStatus(supabase, context.venue.id),
    listStaffDisplayDevices(supabase, context.venue.id),
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
  const runner = describeLedRunnerLink(freshestLedRunner(devicesRes.devices), {
    fresh: Boolean(agentRes.agent.lastSeenAt) && !isAgentStale(agentRes.agent.lastSeenAt),
    programScene: agentRes.agent.programScene,
  });
  const canPushUpdate = canManageScreensControls(context.role, context.email, {
    userId: context.userId,
    wallOpsUserId: context.venue.wall_ops_user_id,
  });
  const canProgram = canManageProgramming(context.role);

  const today = data?.today ?? [];
  const upcoming = data?.upcoming ?? [];
  const drafts = data?.draftEvents ?? [];
  const missingArtists = data?.liveMusicMissingArtists ?? [];
  const attentionCount = drafts.length + missingArtists.length;

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{context.venue.name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {formatVenueTodayHeading(new Date(), context.venue.timezone)}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <PrintWeekFlyerButton />
          <ExportWeekSocialButton />
          {canProgram ? (
            <Button size="sm" render={<Link href="/programming/new" />}>
              Add event
            </Button>
          ) : null}
        </div>
      </header>

      {error || !data ? (
        <p className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          Dashboard query failed. {error ?? "Unknown error"}
        </p>
      ) : (
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Stat label="Next 7 days" value={data.nextSevenCount} />
          <Stat label="Upcoming drafts" value={data.upcomingDraftCount} />
          <Stat label="Active artists" value={data.activeArtistCount} />
        </div>
      )}

      <div className="grid min-h-0 gap-3 lg:flex-1 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-7">
          <Panel
            title="Today"
            href="/programming"
            action="Schedule"
            empty="Nothing on the floor today."
            rows={today.slice(0, TODAY_CAP).map((event) => ({
              id: event.id,
              href: `/programming/${event.id}`,
              title: event.title,
              detail: `${formatVenueTime(event.starts_at, context.venue.timezone)}${
                artistNames(event).length > 0 ? ` · ${artistNames(event).join(", ")}` : ""
              }`,
              status: event.status,
            }))}
            extra={Math.max(0, today.length - TODAY_CAP)}
          />
          <Panel
            title="Upcoming"
            href="/programming"
            action="Event manager"
            empty="No upcoming events."
            rows={upcoming.slice(0, UPCOMING_CAP).map((event) => ({
              id: event.id,
              href: `/programming/${event.id}`,
              title: event.title,
              detail: `${formatVenueTime(event.starts_at, context.venue.timezone)}${
                artistNames(event).length > 0 ? ` · ${artistNames(event).join(", ")}` : ""
              }`,
              status: event.status,
            }))}
            extra={Math.max(0, upcoming.length - UPCOMING_CAP)}
          />
          {attentionCount > 0 ? (
            <section className="grid shrink-0 grid-cols-2 gap-2">
              <Attention
                title="Drafts"
                href="/programming"
                rows={drafts.slice(0, ATTENTION_CAP).map((event) => ({
                  id: event.id,
                  href: `/programming/${event.id}`,
                  label: event.title,
                }))}
                extra={Math.max(0, drafts.length - ATTENTION_CAP)}
                empty="No drafts."
              />
              <Attention
                title="Live music missing artists"
                href="/programming"
                rows={missingArtists.slice(0, ATTENTION_CAP).map((event) => ({
                  id: event.id,
                  href: `/programming/${event.id}/edit`,
                  label: event.title,
                }))}
                extra={Math.max(0, missingArtists.length - ATTENTION_CAP)}
                empty="Every live show has artists."
              />
            </section>
          ) : null}
        </div>

        <div className="min-h-[22rem] lg:col-span-5 lg:min-h-0">
          {ledMissing ? (
            <section className="flex h-full flex-col justify-center rounded-xl border bg-card p-4 text-sm">
              <h2 className="text-base font-semibold">LED wall is not set up</h2>
              <p className="mt-2 text-muted-foreground">
                {canConfigureLedWall(context.role)
                  ? `Apply ${LED_WALL_SQL} in the Supabase SQL editor, then reload.`
                  : "An admin still needs to finish the LED wall setup."}
              </p>
            </section>
          ) : ledError ? (
            <section className="flex h-full flex-col justify-center rounded-xl border bg-card p-4 text-sm">
              <h2 className="text-base font-semibold">Could not load the LED wall</h2>
              <p className="mt-2 text-muted-foreground">{ledError}</p>
            </section>
          ) : (
            <LedWallControl
              scenes={ledScenes}
              activeSceneId={runtimeRes.runtime?.active_scene_id ?? null}
              runner={runner}
              canPushUpdate={canPushUpdate}
              setupHref="/screens"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({
  title,
  href,
  action,
  empty,
  rows,
  extra,
}: {
  title: string;
  href: string;
  action: string;
  empty: string;
  rows: Array<{ id: string; href: string; title: string; detail: string; status: EventStatus }>;
  extra: number;
}) {
  return (
    <section className="flex min-h-36 flex-col rounded-xl border bg-card lg:min-h-0 lg:flex-1">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {extra > 0 ? <span className="text-xs text-muted-foreground">+{extra} more</span> : null}
        <Link href={href} className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline">
          {action}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
                </span>
                <StatusBadge status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Attention({
  title,
  href,
  rows,
  extra,
  empty,
}: {
  title: string;
  href: string;
  rows: Array<{ id: string; href: string; label: string }>;
  extra: number;
  empty: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <h2 className="truncate text-xs font-semibold tracking-wide uppercase">{title}</h2>
        {extra > 0 ? <span className="text-xs text-muted-foreground">+{extra}</span> : null}
        <Link href={href} className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline">
          Open
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} className="block truncate text-sm font-medium underline-offset-4 hover:underline">
                {row.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
