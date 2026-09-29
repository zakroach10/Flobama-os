import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("dashboard");
  return children;
}
