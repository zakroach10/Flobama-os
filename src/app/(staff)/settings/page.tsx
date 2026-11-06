import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { SettingsForms } from "@/components/settings/settings-forms";
import { WebsiteEmbedCard } from "@/components/settings/website-embed-card";
import { GhlIntegrationsCard } from "@/components/settings/ghl-integrations-card";
import { SpotOnIntegrationsCard } from "@/components/settings/spoton-integrations-card";
import { RolePermissionGuide, StaffDirectory } from "@/components/settings/staff-admin";
import { ServerStationAdminPanel } from "@/components/settings/server-station-admin";
import { getPublicAppUrl, isServiceRoleConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listVenueStaff, withWallOpsMenus } from "@/lib/queries/staff";
import { canManageStaff, canConfigureServerStation } from "@/lib/auth/permissions";
import { isMissingWallOpsColumn } from "@/lib/auth/wall-ops";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";
import { getServerStationSettings } from "@/lib/server-station/settings";
import { ErrorState } from "@/components/states";
import { ObsClientDownload } from "@/components/screens/obs-client-download";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  listIntegrationCredentialsForVenue,
  type StaffIntegrationCredential,
} from "@/lib/integrations/credentials-admin";
import { deriveCapabilityStatuses, loadSpotOnSettings, webhookUrlForOrigin } from "@/lib/spoton/status";
import type { SpotOnApiProduct, SpotOnCapabilityStatus } from "@/lib/spoton/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const { members, error, menusReady } = await listVenueStaff(supabase, context.venue.id);

  let wallOpsUserId = context.venue.wall_ops_user_id ?? null;
  let wallOpsReady = true;
  if (wallOpsUserId === null) {
    const venueRes = await supabase.from("venues").select("wall_ops_user_id").eq("id", context.venue.id).maybeSingle();
    if (venueRes.error && isMissingWallOpsColumn(venueRes.error.message)) {
      wallOpsReady = false;
    } else if (!venueRes.error) {
      wallOpsUserId = venueRes.data?.wall_ops_user_id ?? null;
    }
  }

  const { settings: serverStationSettings, missingTable: serverStationMissing } =
    await getServerStationSettings(supabase, context.venue.id);

  const scenesRes = await supabase
    .from("led_wall_scenes")
    .select("id, title, server_approved, artist_id")
    .eq("venue_id", context.venue.id)
    .eq("enabled", true)
    .order("title", { ascending: true });
  const playlistsRes = await supabase
    .from("led_wall_playlists")
    .select("id, name")
    .eq("venue_id", context.venue.id)
    .is("archived_at", null)
    .order("name", { ascending: true });
  const devicesRes = await supabase
    .from("server_station_devices")
    .select("id, label, last_seen_at, revoked_at")
    .eq("venue_id", context.venue.id)
    .order("created_at", { ascending: false });
  const pinsRes = await supabase
    .from("server_station_pins")
    .select("user_id")
    .eq("venue_id", context.venue.id);
  const operatorsRes = await supabase
    .from("server_station_operators")
    .select("id, display_name")
    .eq("venue_id", context.venue.id)
    .is("archived_at", null)
    .order("display_name", { ascending: true });
  const auditRes = await supabase
    .from("server_station_audit_log")
    .select("id, actor_name, action, created_at")
    .eq("venue_id", context.venue.id)
    .order("created_at", { ascending: false })
    .limit(25);

  const pinUserIds = new Set((pinsRes.data ?? []).map((row) => row.user_id));
  const staffPinOptions = members
    .filter((member) => member.role === "admin" || member.role === "manager" || member.role === "server")
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName || member.email || "Staff",
      hasPin: pinUserIds.has(member.userId),
    }));

  const serverStationTableMissing =
    serverStationMissing ||
    Boolean(scenesRes.error && isMissingServerStationRelation(scenesRes.error.message)) ||
    Boolean(devicesRes.error && isMissingServerStationRelation(devicesRes.error.message));

  const canManageIntegrationCredentials = canManageStaff(context.role);
  let integrationCredentials: StaffIntegrationCredential[] = [];
  let integrationCredentialsError: string | null = null;
  if (canManageIntegrationCredentials && isServiceRoleConfigured()) {
    const admin = createServiceRoleClient();
    if (admin) {
      const listed = await listIntegrationCredentialsForVenue(admin, context.venue.id);
      if (listed.ok) integrationCredentials = listed.credentials;
      else integrationCredentialsError = listed.message;
    } else {
      integrationCredentialsError = "Set SUPABASE_SERVICE_ROLE_KEY before managing integration tokens.";
    }
  }

  let spotonSettings = null as Awaited<ReturnType<typeof loadSpotOnSettings>>;
  let spotonRuns: Array<{
    id: string;
    kind: string;
    status: string;
    createdAt: string;
    errorSafe: string | null;
  }> = [];
  let spotonWebhooks: Array<{
    id: string;
    eventId: string;
    category: string;
    status: string;
    createdAt: string;
    error: string | null;
  }> = [];
  try {
    spotonSettings = await loadSpotOnSettings(supabase, context.venue.id);
  } catch {
    spotonSettings = null;
  }
  if (canManageIntegrationCredentials) {
    const runsRes = await supabase
      .from("spoton_sync_runs")
      .select("id, kind, status, created_at, error_safe")
      .eq("venue_id", context.venue.id)
      .order("created_at", { ascending: false })
      .limit(12);
    spotonRuns = (runsRes.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      createdAt: row.created_at,
      errorSafe: row.error_safe,
    }));
    const hooksRes = await supabase
      .from("spoton_webhook_inbox")
      .select("id, event_id, event_category, processing_status, created_at, processing_error")
      .eq("venue_id", context.venue.id)
      .order("created_at", { ascending: false })
      .limit(12);
    // Webhook inbox has no authenticated SELECT — expect empty unless service role used.
    if (!hooksRes.error) {
      spotonWebhooks = (hooksRes.data ?? []).map((row) => ({
        id: row.id,
        eventId: row.event_id,
        category: row.event_category,
        status: row.processing_status,
        createdAt: row.created_at,
        error: row.processing_error,
      }));
    } else if (isServiceRoleConfigured()) {
      const admin = createServiceRoleClient();
      if (admin) {
        const adminHooks = await admin
          .from("spoton_webhook_inbox")
          .select("id, event_id, event_category, processing_status, created_at, processing_error")
          .eq("venue_id", context.venue.id)
          .order("created_at", { ascending: false })
          .limit(12);
        spotonWebhooks = (adminHooks.data ?? []).map((row) => ({
          id: row.id,
          eventId: row.event_id,
          category: row.event_category,
          status: row.processing_status,
          createdAt: row.created_at,
          error: row.processing_error,
        }));
      }
    }
  }
  const spotonCapabilities = deriveCapabilityStatuses(spotonSettings);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Account, roles, and venue defaults for this staff workspace.</p>
      </div>
      <ServerStationAdminPanel
        settings={serverStationSettings}
        scenes={(scenesRes.data ?? []).map((scene) => ({
          id: scene.id,
          title: scene.title,
          server_approved: Boolean((scene as { server_approved?: boolean }).server_approved),
          artist_id: (scene as { artist_id?: string | null }).artist_id ?? null,
        }))}
        playlists={playlistsRes.data ?? []}
        devices={devicesRes.data ?? []}
        staffOptions={staffPinOptions}
        operators={(operatorsRes.data ?? []).map((row) => ({
          id: row.id,
          displayName: row.display_name,
        }))}
        operatorsMissing={Boolean(
          operatorsRes.error && isMissingServerStationRelation(operatorsRes.error.message),
        )}
        audit={auditRes.data ?? []}
        missingTable={serverStationTableMissing}
        canManage={canConfigureServerStation(context.role)}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">LED wall OBS client</h2>
        <p className="text-sm text-muted-foreground">
          Download 1.0.2 onto the booth Mac. Eject any older FloBama LED OBS disk first. Terminal must start with FloBama LED OBS 1.0.2, then ask for the token from Screens → OBS Setup.
        </p>
        <ObsClientDownload />
      </section>
      <RolePermissionGuide />
      {error ? (
        <ErrorState
          title="Could not load staff"
          description={`${error} Apply supabase/migrations/20260908000003_staff_admin.sql if the staff directory function is missing.`}
        />
      ) : (
        <StaffDirectory
          members={withWallOpsMenus(members, wallOpsUserId)}
          currentUserId={context.userId}
          canManage={canManageStaff(context.role)}
          serviceRoleConfigured={isServiceRoleConfigured()}
          menusReady={menusReady}
          wallOpsUserId={wallOpsUserId}
          wallOpsReady={wallOpsReady}
        />
      )}
      <WebsiteEmbedCard siteUrl={getPublicAppUrl()} />
      <GhlIntegrationsCard
        integrationCredentials={integrationCredentials}
        canManageIntegrationCredentials={canManageIntegrationCredentials}
        serviceRoleConfigured={isServiceRoleConfigured()}
        apiBaseUrl={getPublicAppUrl()}
        integrationCredentialsError={integrationCredentialsError}
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Integrations · SpotOn</h2>
        <SpotOnIntegrationsCard
          canManage={canManageIntegrationCredentials}
          webhookUrl={webhookUrlForOrigin(getPublicAppUrl())}
          settings={{
            apiProduct: (spotonSettings?.api_product ?? "none") as SpotOnApiProduct,
            locationId: spotonSettings?.location_id ?? null,
            businessDayCutoffLocal: spotonSettings?.business_day_cutoff_local ?? "04:00:00",
            eventWindowPreMinutes: spotonSettings?.event_window_pre_minutes ?? 0,
            eventWindowPostMinutes: spotonSettings?.event_window_post_minutes ?? 0,
            syncEnabled: spotonSettings?.sync_enabled ?? false,
            publishMappedMenu: spotonSettings?.publish_mapped_menu ?? false,
            notes: spotonSettings?.notes ?? null,
            lastWebhookAt: spotonSettings?.last_webhook_at ?? null,
            lastWebhookEventId: spotonSettings?.last_webhook_event_id ?? null,
            lastProcessedEventId: spotonSettings?.last_processed_event_id ?? null,
            lastProcessedEventAt: spotonSettings?.last_processed_event_at ?? null,
            lastSuccessfulSyncAt: spotonSettings?.last_successful_sync_at ?? null,
            coverageThrough: spotonSettings?.coverage_through ?? null,
            lastConnectionTestAt: spotonSettings?.last_connection_test_at ?? null,
            lastConnectionTestOk: spotonSettings?.last_connection_test_ok ?? null,
            lastConnectionTestMessage: spotonSettings?.last_connection_test_message ?? null,
          }}
          capabilities={{
            webhook: spotonCapabilities.webhook as SpotOnCapabilityStatus,
            reporting: spotonCapabilities.reporting as SpotOnCapabilityStatus,
            menu: spotonCapabilities.menu as SpotOnCapabilityStatus,
          }}
          credentials={spotonCapabilities.credentials}
          recentRuns={spotonRuns}
          recentWebhooks={spotonWebhooks}
        />
      </section>
      <SettingsForms
        displayName={context.profile?.display_name ?? ""}
        venueName={context.venue.name}
        timeZone={context.venue.timezone}
        role={context.role}
        email={context.email}
      />
    </div>
  );
}
