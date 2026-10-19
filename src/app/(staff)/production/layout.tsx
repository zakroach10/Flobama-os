import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("production");
  return children;
}
