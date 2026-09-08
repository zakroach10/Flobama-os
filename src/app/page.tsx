import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupRequired } from "@/components/states";
import { missingPublicEnvNames } from "@/lib/env";
import { getStaffContext } from "@/lib/auth/staff";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }
  const context = await getStaffContext();
  if (context.status === "ok") redirect("/dashboard");
  if (context.status === "denied") redirect("/access-denied");
  redirect("/login");
}
