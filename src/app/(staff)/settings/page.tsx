import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { SettingsForms } from "@/components/settings/settings-forms";
import { WebsiteEmbedCard } from "@/components/settings/website-embed-card";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Account and venue defaults for this staff workspace.</p>
      </div>
      <WebsiteEmbedCard siteUrl={getSiteUrl()} />
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
