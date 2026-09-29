import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function AdminTicketingLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("ticketing");
  return children;
}
