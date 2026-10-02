import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeAudienceRun } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AUDIENCE_PICTURE_SQL,
  AUDIENCE_PRESETS_SQL,
  AUDIENCE_SETTINGS_SQL,
  AUDIENCE_SQL_ROLE,
  AUDIENCE_SQL_TABLES,
  LED_AUDIENCE_SCENE_SEED_SQL,
  LED_AUDIENCE_SCENE_SQL,
} from "@/lib/constants";
import { getPublicAppUrl, getPublicSupabaseEnv } from "@/lib/env";
import { loadAudienceWorkspace } from "@/lib/queries/audience";
import { AudienceWorkspace } from "@/components/audience/audience-workspace";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function AudiencePage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login?next=/audience");
  const allowed = authorizeAudienceRun(context.role);
  if (!allowed.allowed) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login?next=/audience");

  const data = await loadAudienceWorkspace(supabase, context.venue.id);
  if (data.missingTable) {
    return (
      <ErrorState
        title="Audience Interactor needs a database update"
        description={`Apply ${AUDIENCE_SQL_ROLE}, then ${AUDIENCE_SQL_TABLES}, then ${AUDIENCE_SETTINGS_SQL}, then ${AUDIENCE_PRESETS_SQL}, then ${AUDIENCE_PICTURE_SQL}, then ${LED_AUDIENCE_SCENE_SQL} and ${LED_AUDIENCE_SCENE_SEED_SQL} in the Supabase SQL editor.`}
      />
    );
  }
  if (data.error) {
    return <ErrorState title="Could not load Audience Interactor" description={data.error} />;
  }

  return (
    <AudienceWorkspace
      session={data.session}
      tools={data.tools}
      questions={data.questions}
      presets={data.presets}
      settings={data.settings}
      apiBase={getPublicAppUrl() ?? ""}
      venueId={context.venue.id}
      supabaseEnv={getPublicSupabaseEnv()}
      missingPresetsTable={data.missingPresetsTable}
    />
  );
}
