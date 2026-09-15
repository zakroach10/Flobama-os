import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canManageProgramming } from "@/lib/auth/permissions";
import { SocialSubnav } from "@/components/social/social-subnav";

export const dynamic = "force-dynamic";

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!canManageProgramming(context.role)) redirect("/dashboard");

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
