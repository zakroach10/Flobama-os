"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ScreensTab = "led" | "vertical" | "trivia";

export function ScreensWorkspace({
  defaultTab,
  led,
  vertical,
  trivia,
  showVertical = true,
  showTrivia = true,
}: {
  defaultTab: ScreensTab;
  led: React.ReactNode;
  vertical: React.ReactNode;
  trivia: React.ReactNode;
  showVertical?: boolean;
  showTrivia?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ScreensTab>(defaultTab);
  const [syncedTab, setSyncedTab] = useState(defaultTab);
  if (syncedTab !== defaultTab) {
    setSyncedTab(defaultTab);
    setTab(defaultTab);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (value !== "led" && value !== "vertical" && value !== "trivia") return;
        if (value === "vertical" && !showVertical) return;
        if (value === "trivia" && !showTrivia) return;
        setTab(value);
        const path =
          value === "vertical" ? "/screens?tab=vertical" : value === "trivia" ? "/screens?tab=trivia" : "/screens";
        router.replace(path, { scroll: false });
      }}
      className="gap-6"
    >
      <TabsList variant="line" className="h-auto min-h-11 w-full justify-start overflow-x-auto rounded-none">
        <TabsTrigger value="led" className="min-h-11 px-3">
          LED wall
        </TabsTrigger>
        {showVertical ? (
          <TabsTrigger value="vertical" className="min-h-11 px-3">
            Vertical screens
          </TabsTrigger>
        ) : null}
        {showTrivia ? (
          <TabsTrigger value="trivia" className="min-h-11 px-3">
            Trivia
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="led" className="space-y-8">
        {led}
      </TabsContent>
      {showVertical ? (
        <TabsContent value="vertical" className="space-y-8">
          {vertical}
        </TabsContent>
      ) : null}
      {showTrivia ? (
        <TabsContent value="trivia" className="space-y-8">
          {trivia}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
