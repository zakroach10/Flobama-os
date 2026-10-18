import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { SettingsForms } from "@/components/settings/settings-forms";
import { WebsiteEmbedCard } from "@/components/settings/website-embed-card";
import { GhlIntegrationsCard } from "@/components/settings/ghl-integrations-card";
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
      <GhlIntegrationsCard />
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
