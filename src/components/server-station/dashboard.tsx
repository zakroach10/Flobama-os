"use client";

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
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#f7efe6] sm:text-4xl">What do you need?</h1>
        <p className="max-w-2xl text-lg text-[#e8d5c4]/90">
          Big buttons for the floor. Tap one to help a guest or update the LED wall.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ServerStationTile
          href="/server/events"
          title="Explore Events"
          description="View schedules and answer guest questions."
          accent="cool"
        />
        <ServerStationTile
          href="/server/wall"
          title="LED Wall Controls"
          description="POS-style wall picker — 20 preview tiles per page, no scrolling."
          accent="warm"
        />
        <ServerStationTile
          href="/server/specials"
          title="Food & Drink Specials"
          description="Create promotional slides for the wall."
          accent="gold"
        />
        <ServerStationTile
          href="/server/birthday"
          title="Birthday Screen"
          description="Celebrate birthdays, anniversaries, and other occasions."
          accent="rose"
        />
        <ServerStationTile
          href="/server/message"
          title="Custom Message"
          description="Create a short announcement for the LED wall."
          accent="cool"
        />
        <ServerStationTile
          href="/server/upload"
          title="Upload from Phone"
          description="Show a QR code to upload a picture from a phone."
          accent="warm"
        />
        <ServerStationTile
          href="/server/active"
          title="Your Rotation"
          description="See deals, messages, and celebrations you added — and take them down."
          accent="gold"
        />
      </div>
    </ServerStationShell>
  );
}
