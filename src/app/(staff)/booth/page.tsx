import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/queries/dashboard";
import { canManageProgramming } from "@/lib/auth/permissions";
import { BoothControls } from "@/components/booth/booth-controls";
import { ObsPanel } from "@/components/booth/obs-panel";
import { ErrorState } from "@/components/states";
import { getSiteUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";

export const dynamic = "force-dynamic";

export default async function BoothPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const [{ data, error }, booth] = await Promise.all([
    loadDashboard(supabase, context.venue.id, context.venue.timezone),
    supabase.from("booth_state").select("live_event_id, lower_third_visible").eq("venue_id", context.venue.id).maybeSingle(),
  ]);

  if (error || !data) {
    return <ErrorState title="Could not load booth agenda" description={error ?? "Unknown error"} />;
  }
  if (booth.error) {
    return <ErrorState title="Could not load booth state" description={booth.error.message} />;
  }

  const overlayUrl = joinPublicUrl(getSiteUrl(), "/overlay");
  const canControl = canManageProgramming(context.role);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Booth</h1>
        <p className="text-muted-foreground">
          Control the OBS browser source and the public now-playing state. Overlay URL:{" "}
          <Link className="underline-offset-4 hover:underline" href="/overlay">
            {overlayUrl}
          </Link>
        </p>
      </header>
      <BoothControls
        events={data.today}
        liveEventId={booth.data?.live_event_id ?? null}
        lowerThirdVisible={booth.data?.lower_third_visible ?? false}
        timeZone={context.venue.timezone}
        canControl={canControl}
      />
      {canControl ? <ObsPanel /> : null}
      <section className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        In OBS: Tools → WebSocket Server Settings (v5). Add a Browser Source pointed at {overlayUrl}, width 1920,
        height 1080, and enable shutdown source when not visible.
      </section>
    </div>
  );
}
