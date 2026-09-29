import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function SettingsSectionLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("settings");
  return children;
}
