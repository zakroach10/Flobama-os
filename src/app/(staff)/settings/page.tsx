import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { SettingsForms } from "@/components/settings/settings-forms";
import { WebsiteEmbedCard } from "@/components/settings/website-embed-card";
import { GhlIntegrationsCard } from "@/components/settings/ghl-integrations-card";
import { RolePermissionGuide, StaffDirectory } from "@/components/settings/staff-admin";
import { getPublicAppUrl, isServiceRoleConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listVenueStaff } from "@/lib/queries/staff";
import { canManageStaff } from "@/lib/auth/permissions";
import { ErrorState } from "@/components/states";
import { ObsClientDownload } from "@/components/screens/obs-client-download";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const { members, error } = await listVenueStaff(supabase, context.venue.id);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Account, roles, and venue defaults for this staff workspace.</p>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">LED wall OBS client</h2>
        <p className="text-sm text-muted-foreground">
          Download 1.0.1 onto the booth Mac. Eject any disk named FloBama LED OBS first. Terminal must start with FloBama LED OBS 1.0.1, then ask for the token from Screens → OBS Setup.
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
          members={members}
          currentUserId={context.userId}
          canManage={canManageStaff(context.role)}
          serviceRoleConfigured={isServiceRoleConfigured()}
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
