import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function AudienceLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("audience");
  return children;
}
