import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function ProgrammingLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("programming");
  return children;
}
