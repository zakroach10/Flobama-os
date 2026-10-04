import type { Metadata } from "next";
import PageView from "@/components/site/pages/help-run";

export const metadata: Metadata = {
  title: "Run FloBama OS",
  description: "Instructions to install, configure, and run FloBama OS locally.",
};

export default function Page() {
  return <PageView />;
}
