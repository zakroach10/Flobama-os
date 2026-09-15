import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicAppUrl, isGhlConfigured } from "@/lib/env";
import { listSocialAccounts, weekSocialMediaUrls, weekSocialPageCount } from "@/lib/ghl/social";
import { listPublicWeekEvents } from "@/lib/public/queries";
import {
  isWeekSocialFormatId,
  WEEK_SOCIAL_FORMATS,
  weekSocialFormat,
  type WeekSocialFormatId,
} from "@/lib/screens/social";
import { buildWeekSlidePayload } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { EmptyState, ErrorState } from "@/components/states";
import { SocialComposeForm } from "@/components/social/social-compose-form";

export const dynamic = "force-dynamic";

export default async function SocialComposePage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; page?: string }>;
}) {
  const params = await searchParams;
  const format = weekSocialFormat(isWeekSocialFormatId(params.size) ? params.size : undefined);

  if (!isGhlConfigured()) {
    return (
      <EmptyState
        title="GoHighLevel is not connected"
        description="Set GHL_PRIVATE_TOKEN and GHL_LOCATION_ID before composing Social Planner posts."
        actionHref="/settings"
        actionLabel="Open settings"
      />
    );
  }

  let accountsError: string | undefined;
  let accounts = [] as Awaited<ReturnType<typeof listSocialAccounts>>;
  try {
    accounts = await listSocialAccounts();
  } catch (error) {
    accountsError = error instanceof Error ? error.message : "Could not load social accounts.";
  }

  const client = createAnonSupabaseClient();
  const week = client
    ? buildWeekSlidePayload((await listPublicWeekEvents(client, FLO_BAMA_VENUE_ID)).events)
    : { days: [], rangeLabel: "This week" };
  const pageCountByFormat = Object.fromEntries(
    WEEK_SOCIAL_FORMATS.map((item) => [item.id, weekSocialPageCount(week.days, item.id)]),
  ) as Record<WeekSocialFormatId, number>;
  const publicOrigin = getPublicAppUrl();
  const pageCount = pageCountByFormat[format.id];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Compose week graphic</h2>
        <p className="text-sm text-muted-foreground">
          Posts {week.rangeLabel} lineup PNG{pageCount > 1 ? `s (${pageCount} pages)` : ""} to selected GHL accounts.
          Defaults to <strong>Post now</strong>; you can also schedule or save a draft.
        </p>
      </div>
      {accountsError ? <ErrorState title="Could not load accounts" description={accountsError} /> : null}
      <SocialComposeForm
        accounts={accounts}
        formatId={format.id}
        pageCountByFormat={pageCountByFormat}
        publicOrigin={publicOrigin}
      />
      <p className="sr-only">{weekSocialMediaUrls({ formatId: format.id, pageCount, origin: publicOrigin }).join(" ")}</p>
    </div>
  );
}
