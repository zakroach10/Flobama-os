"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ScreensTab = "led" | "vertical";

export function ScreensWorkspace({
  defaultTab,
  led,
  vertical,
  showVertical = true,
}: {
  defaultTab: ScreensTab;
  led: React.ReactNode;
  vertical: React.ReactNode;
  showVertical?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ScreensTab>(defaultTab);
  const [syncedTab, setSyncedTab] = useState(defaultTab);
  if (syncedTab !== defaultTab) {
    setSyncedTab(defaultTab);
    setTab(defaultTab);
  }

  if (!showVertical) {
    return <div className="space-y-8">{led}</div>;
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (value !== "led" && value !== "vertical") return;
        setTab(value);
        router.replace(value === "vertical" ? "/screens?tab=vertical" : "/screens", { scroll: false });
      }}
      className="gap-6"
    >
      <TabsList variant="line" className="h-auto min-h-11 w-full justify-start overflow-x-auto rounded-none">
        <TabsTrigger value="led" className="min-h-11 px-3">
          LED wall
        </TabsTrigger>
        <TabsTrigger value="vertical" className="min-h-11 px-3">
          Vertical screens
        </TabsTrigger>
      </TabsList>
      <TabsContent value="led" className="space-y-8">
        {led}
      </TabsContent>
      <TabsContent value="vertical" className="space-y-8">
        {vertical}
      </TabsContent>
    </Tabs>
  );
}
