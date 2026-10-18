"use client";

import {
  CakeIcon,
  CalendarDaysIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  SmartphoneIcon,
  UtensilsCrossedIcon,
} from "lucide-react";
import { ServerStationShell, ServerStationTile } from "@/components/server-station/shell";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

export function ServerStationDashboard({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  return (
    <ServerStationShell actorName={actorName} wall={wall} showBack={false} title="Server Station">
      <div className="mb-3 lg:mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#f7efe6] lg:text-3xl">What do you need?</h1>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:gap-3">
        <ServerStationTile
          href="/server/events"
          title="Explore Events"
          description="Schedules and guest questions."
          icon={CalendarDaysIcon}
          accent="cool"
        />
        <ServerStationTile
          href="/server/wall"
          title="LED Wall"
          description="Pick a scene for the wall."
          icon={MonitorPlayIcon}
          accent="warm"
        />
        <ServerStationTile
          href="/server/specials"
          title="Food & Drink"
          description="Promotional slides for the wall."
          icon={UtensilsCrossedIcon}
          accent="gold"
        />
        <ServerStationTile
          href="/server/birthday"
          title="Celebration"
          description="Birthdays, anniversaries, and more."
          icon={CakeIcon}
          accent="rose"
        />
        <ServerStationTile
          href="/server/message"
          title="Custom Message"
          description="A short announcement for the wall."
          icon={MessageSquareTextIcon}
          accent="cool"
        />
        <ServerStationTile
          href="/server/upload"
          title="Phone Upload"
          description="Show a QR code for a guest photo."
          icon={SmartphoneIcon}
          accent="warm"
        />
      </div>
    </ServerStationShell>
  );
}
