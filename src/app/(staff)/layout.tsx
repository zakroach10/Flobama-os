import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { SetupRequired } from "@/components/states";
import { ErrorState } from "@/components/states";
import { AppShell } from "@/components/layout/app-shell";
import { STAFF_ROLE_LABELS } from "@/lib/constants";
import { canManageProgramming } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }

  const context = await getStaffContext();
  if (context.status === "unauthenticated") {
    redirect("/login?next=/dashboard");
  }
  if (context.status === "denied") {
    redirect("/access-denied");
  }
  if (context.status === "error" || context.status === "unconfigured") {
    return (
      <div className="p-8">
        <ErrorState
          title="Could not load staff session"
          description={context.status === "error" ? context.message : "Supabase is not configured."}
        />
      </div>
    );
  }

  return (
    <AppShell
      venueName={context.venue.name}
      roleLabel={STAFF_ROLE_LABELS[context.role]}
      userLabel={context.profile?.display_name || context.email || "Staff"}
      showScreens={canManageProgramming(context.role)}
      showBooking={canManageProgramming(context.role)}
      showSocial={canManageProgramming(context.role)}
    >
      {children}
    </AppShell>
  );
}
