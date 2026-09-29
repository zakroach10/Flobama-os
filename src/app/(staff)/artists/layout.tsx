import { requireStaffMenu } from "@/lib/auth/require-menu";

export const dynamic = "force-dynamic";

export default async function ArtistsLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("artists");
  return children;
}
