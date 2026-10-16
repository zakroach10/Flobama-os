import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { SetupRequired } from "@/components/states";
import { ErrorState } from "@/components/states";
import { AppShell } from "@/components/layout/app-shell";
import { WallOpsPwaRegister } from "@/components/pwa/wall-ops-pwa-register";
import { STAFF_ROLE_LABELS } from "@/lib/constants";
import { firstMenuHref, isWallOpsShell } from "@/lib/auth/menus";
import { WALL_OPS_HOME_PATH, WALL_OPS_LOGIN_PATH } from "@/lib/auth/wall-ops";
import { safeInternalPath } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

function unauthenticatedRedirect(pathname: string) {
  if (pathname === WALL_OPS_HOME_PATH || pathname.startsWith(`${WALL_OPS_HOME_PATH}/`)) {
    return `${WALL_OPS_LOGIN_PATH}?next=${encodeURIComponent(WALL_OPS_HOME_PATH)}&reason=expired`;
  }
  const next = safeInternalPath(pathname, "/dashboard");
  return `/login?next=${encodeURIComponent(next)}`;
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") || headerStore.get("next-url") || "/dashboard";

  const context = await getStaffContext();
  if (context.status === "unauthenticated") {
    redirect(unauthenticatedRedirect(pathname));
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

  const wallOps = isWallOpsShell(context.menus);

  return (
    <AppShell
      venueName={context.venue.name}
      roleLabel={STAFF_ROLE_LABELS[context.role]}
      userLabel={context.profile?.display_name || context.email || "Staff"}
      menus={context.menus}
      homeHref={firstMenuHref(context.menus) ?? "/no-menus"}
    >
      {wallOps ? <WallOpsPwaRegister /> : null}
      {children}
    </AppShell>
  );
}
