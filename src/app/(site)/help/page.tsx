import type { Metadata } from "next";
import PageView from "@/components/site/pages/help-home";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "FloBama OS Help Center — introduction, FAQ, and instructions to run the platform.",
};

export default function Page() {
  return <PageView />;
}
