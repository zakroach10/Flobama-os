import type { Metadata } from "next";
import PageView from "@/components/site/pages/help-introduction";

export const metadata: Metadata = {
  title: "Introduction",
  description: "Introduction to FloBama OS — public site and staff operations platform.",
};

export default function Page() {
  return <PageView />;
}
