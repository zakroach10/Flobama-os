import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canManageProgramming } from "@/lib/auth/permissions";
import { CustomerMigrationNotice } from "@/components/customer/customer-subnav";
import { RecordingForm } from "@/components/customer/recording-form";
import { listCustomerRecordings } from "@/lib/queries/customer-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function CustomerRecordingsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const venueId = context.venue.id;
  const [{ recordings, error, missing }, events, artists] = await Promise.all([
    listCustomerRecordings(supabase, venueId),
    supabase.from("events").select("id, title").eq("venue_id", venueId).is("archived_at", null).order("starts_at", { ascending: false }).limit(40),
    supabase.from("artists").select("id, name").eq("venue_id", venueId).is("archived_at", null).order("name").limit(80),
  ]);
  const canEdit = canManageProgramming(context.role);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Mux sends a draft here when a live stream finishes. Publish it, and link the show and artist, before it appears in the app.
      </p>
      {missing ? <CustomerMigrationNotice /> : null}
      {error && !missing ? <ErrorState title="Could not load recordings" description={error} /> : null}
      {canEdit && !missing ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Add recording</h2>
          <RecordingForm canEdit={canEdit} events={events.data ?? []} artists={artists.data ?? []} />
        </section>
      ) : null}
      <div className="space-y-4">
        {recordings.map((recording) => (
          <section key={recording.id} className="rounded-xl border bg-card p-5">
            <p className="mb-3 text-sm text-muted-foreground">{recording.published ? "Published" : "Draft"}</p>
            <RecordingForm recording={recording} canEdit={canEdit} events={events.data ?? []} artists={artists.data ?? []} />
          </section>
        ))}
      </div>
    </div>
  );
}
