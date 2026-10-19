import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import {
  authorizeProductionConfigure,
  authorizeProductionControl,
  canOperateProduction,
  canConfigureProduction,
} from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRODUCTION_ECAMM_SQL } from "@/lib/constants";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import {
  getProductionSettings,
  getProductionDeviceStatus,
  getVenueProductionDeviceStatus,
  listProductionMarkers,
  listProductionRecordingEvents,
  listProductionRelevantEvents,
  listProductionSessions,
  listRecentProductionCommands,
} from "@/lib/queries/production";
import { ProductionWorkspace } from "@/components/production/production-workspace";
import { ErrorState } from "@/components/states";
import { ecammEndpointCoverageCounts } from "@/lib/production/ecamm-endpoints";

export const dynamic = "force-dynamic";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; tab?: string }>;
}) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login?next=/production");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login?next=/production");

  const params = await searchParams;
  const eventId = params.eventId?.trim() || null;

  const settingsRes = await getProductionSettings(supabase, context.venue.id);
  if (settingsRes.missingTable) {
    return (
      <ErrorState
        title="Could not load Production"
        description={`Apply ${PRODUCTION_ECAMM_SQL} in the Supabase SQL editor, then reload Production.`}
      />
    );
  }

  const devicesRes = await listStaffDisplayDevices(supabase, context.venue.id);
  const productionDevices = devicesRes.devices.filter(
    (d) => d.kind === "production_runner" || d.kind === "led_runner",
  );

  let deviceId = settingsRes.settings?.production_device_id ?? null;
  if (!deviceId) {
    const preferred = productionDevices
      .filter((d) => d.kind === "production_runner" && !d.revoked_at)
      .sort((a, b) => Date.parse(b.last_seen_at || "") - Date.parse(a.last_seen_at || ""))[0];
    deviceId = preferred?.id ?? null;
  }

  const statusRes = deviceId
    ? await getProductionDeviceStatus(supabase, deviceId)
    : await getVenueProductionDeviceStatus(supabase, context.venue.id);

  const [sessionsRes, markersRes, commandsRes, recordingEventsRes, eventsRes] = await Promise.all([
    listProductionSessions(supabase, context.venue.id, { eventId, limit: 40 }),
    listProductionMarkers(supabase, context.venue.id, { limit: 80 }),
    listRecentProductionCommands(supabase, context.venue.id, { deviceId, limit: 30 }),
    listProductionRecordingEvents(supabase, context.venue.id, { limit: 40 }),
    listProductionRelevantEvents(supabase, context.venue.id),
  ]);

  if (sessionsRes.missingTable || markersRes.missingTable || commandsRes.missingTable) {
    return (
      <ErrorState
        title="Production tables missing"
        description={`Apply ${PRODUCTION_ECAMM_SQL} in the Supabase SQL editor, then reload.`}
      />
    );
  }

  const canControl = authorizeProductionControl(context.role).allowed;
  const canConfigure = authorizeProductionConfigure(context.role).allowed;

  return (
    <ProductionWorkspace
      venueName={context.venue.name}
      initialEventId={eventId}
      initialTab={params.tab ?? "overview"}
      settings={settingsRes.settings}
      deviceStatus={statusRes.status}
      live={statusRes.live}
      devices={productionDevices}
      sessions={sessionsRes.sessions}
      markers={markersRes.markers}
      commands={commandsRes.commands}
      recordingEvents={recordingEventsRes.events}
      events={eventsRes.events}
      coverage={ecammEndpointCoverageCounts()}
      canControl={canControl && canOperateProduction(context.role)}
      canConfigure={canConfigure && canConfigureProduction(context.role)}
      canViewOnly={!canControl}
    />
  );
}
