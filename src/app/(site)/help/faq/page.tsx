import type { Metadata } from "next";
import PageView from "@/components/site/pages/help-faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about FloBama OS.",
};

export default function Page() {
  return <PageView />;
}
