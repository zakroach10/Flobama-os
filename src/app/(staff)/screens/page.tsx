import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageProgramming } from "@/lib/auth/permissions";
import { getScreenWallState, listStaffScreenAds } from "@/lib/queries/screens";
import { LedWallPanel } from "@/components/screens/led-wall-panel";
import { VerticalAdsPanel } from "@/components/screens/vertical-ads-panel";
import { ErrorState } from "@/components/states";
import { getPublicAppUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";

export const dynamic = "force-dynamic";

export default async function ScreensPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!canManageProgramming(context.role)) redirect("/dashboard");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const [{ wall, error: wallError }, { ads, error: adsError }] = await Promise.all([
    getScreenWallState(supabase, context.venue.id),
    listStaffScreenAds(supabase, context.venue.id),
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
          Enable OBS scenes for the 16ft LED wall and rotate ads on the shared vertical players.
        </p>
      </header>
      <LedWallPanel wall={wall} />
      <VerticalAdsPanel ads={ads} displayUrl={joinPublicUrl(getPublicAppUrl(), "/display/vertical")} />
    </div>
  );
}
