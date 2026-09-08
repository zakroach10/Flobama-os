import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageProgramming } from "@/lib/auth/permissions";
import { getScreenWallState, getStaffTakeover, listStaffScreenAds } from "@/lib/queries/screens";
import { LedWallPanel } from "@/components/screens/led-wall-panel";
import { TakeoverPanel } from "@/components/screens/takeover-panel";
import { VerticalAdsPanel } from "@/components/screens/vertical-ads-panel";
import { ErrorState } from "@/components/states";
import { getPublicAppUrl, getPublicSupabaseEnv } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";

export const dynamic = "force-dynamic";

export default async function ScreensPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!canManageProgramming(context.role)) redirect("/dashboard");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const [{ wall, error: wallError }, { ads, error: adsError }, takeoverRes] = await Promise.all([
    getScreenWallState(supabase, context.venue.id),
    listStaffScreenAds(supabase, context.venue.id),
    getStaffTakeover(supabase, context.venue.id),
  ]);

  if (wallError) {
    return (
      <ErrorState
        title="Could not load LED wall settings"
        description={`${wallError} Apply supabase/migrations/20260908000005_screens.sql if these tables are missing.`}
      />
    );
  }
  if (adsError) {
    return <ErrorState title="Could not load ads" description={adsError} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Screens</h1>
        <p className="text-muted-foreground">
          Enable OBS scenes for the 16ft LED wall, rotate ads on the shared vertical players, and hold one
          graphic when a band or event takes over.
        </p>
      </header>
      <LedWallPanel wall={wall} />
      <TakeoverPanel ads={ads} takeover={takeoverRes.takeover} missingTable={takeoverRes.missingTable} />
      <VerticalAdsPanel
        ads={ads}
        venueId={context.venue.id}
        displayUrl={joinPublicUrl(getPublicAppUrl(), "/display/vertical")}
        supabaseEnv={getPublicSupabaseEnv()}
      />
    </div>
  );
}
