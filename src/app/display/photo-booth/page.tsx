import type { Metadata } from "next";
import { PhotoBoothKiosk } from "@/components/photo-booth/kiosk";

export const metadata: Metadata = {
  title: "Photo booth",
  robots: { index: false, follow: false },
};

export default async function PhotoBoothPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  return <PhotoBoothKiosk demo={params.demo === "1"} />;
}
