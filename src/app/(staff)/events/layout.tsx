import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("events");
  return children;
}
