import { requireStaffMenu } from "@/lib/auth/require-menu";
import { SocialSubnav } from "@/components/social/social-subnav";

export const dynamic = "force-dynamic";

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("social");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Social</h1>
        <p className="text-muted-foreground">
          Weekly event graphics and posts via GoHighLevel Social Planner. GHL stays the system of record.
        </p>
      </header>
      <SocialSubnav />
      {children}
    </div>
  );
}
