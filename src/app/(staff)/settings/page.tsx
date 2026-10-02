import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { SettingsForms } from "@/components/settings/settings-forms";
import { WebsiteEmbedCard } from "@/components/settings/website-embed-card";
import { GhlIntegrationsCard } from "@/components/settings/ghl-integrations-card";
import { RolePermissionGuide, StaffDirectory } from "@/components/settings/staff-admin";
import { getPublicAppUrl, isServiceRoleConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listVenueStaff, withWallOpsMenus } from "@/lib/queries/staff";
import { canManageStaff } from "@/lib/auth/permissions";
import { isMissingWallOpsColumn } from "@/lib/auth/wall-ops";
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

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Account, roles, and venue defaults for this staff workspace.</p>
      </div>
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
