"use client";

import {
  CakeIcon,
  CalendarDaysIcon,
  ClapperboardIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  Music2Icon,
  SmartphoneIcon,
  UtensilsCrossedIcon,
  TvMinimalPlayIcon,
  type LucideIcon,
} from "lucide-react";
import { ServerStationShell, ServerStationTile } from "@/components/server-station/shell";
import {
  isServerStationMenuEnabled,
  type ServerStationMenuKey,
  type ServerStationMenusEnabled,
} from "@/lib/server-station/features";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

const TILES: Array<{
  key: ServerStationMenuKey;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: "cool" | "warm" | "gold" | "rose";
}> = [
  {
    key: "events",
    href: "/server/events",
    title: "Explore Events",
    description: "Schedules and guest questions.",
    icon: CalendarDaysIcon,
    accent: "cool",
  },
  {
    key: "wall",
    href: "/server/wall",
    title: "LED Wall",
    description: "Pick a scene for the wall.",
    icon: MonitorPlayIcon,
    accent: "warm",
  },
  {
    key: "performances",
    href: "/server/performances",
    title: "Performances",
    description: "Play published shows on the wall.",
    icon: Music2Icon,
    accent: "cool",
  },
  {
    key: "specials",
    href: "/server/specials",
    title: "Food & Drink",
    description: "Promotional slides for the wall.",
    icon: UtensilsCrossedIcon,
    accent: "gold",
  },
  {
    key: "birthday",
    href: "/server/birthday",
    title: "Celebration",
    description: "Birthdays, anniversaries, and more.",
    icon: CakeIcon,
    accent: "rose",
  },
  {
    key: "message",
    href: "/server/message",
    title: "Custom Message",
    description: "A short announcement for the wall.",
    icon: MessageSquareTextIcon,
    accent: "cool",
  },
  {
    key: "upload",
    href: "/server/upload",
    title: "Phone Upload",
    description: "Show a QR code for a guest photo.",
    icon: SmartphoneIcon,
    accent: "warm",
  },
  {
    key: "youtube",
    href: "/server/youtube",
    title: "YouTube",
    description: "Play a video link, then back to normal.",
    icon: TvMinimalPlayIcon,
    accent: "cool",
  },
  {
    key: "active",
    href: "/server/active",
    title: "Your Rotation",
    description: "What’s live or queued from this station.",
    icon: ClapperboardIcon,
    accent: "gold",
  },
];

export function ServerStationDashboard({
  actorName,
  wall,
  menusEnabled,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  menusEnabled: ServerStationMenusEnabled;
}) {
  const tiles = TILES.filter((tile) => isServerStationMenuEnabled(menusEnabled, tile.key));

  return (
    <ServerStationShell actorName={actorName} wall={wall} showBack={false} title="Server Station">
      <div className="mb-3 lg:mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#f7efe6] lg:text-3xl">What do you need?</h1>
      </div>
      {tiles.length === 0 ? (
        <p className="rounded-[28px] border border-white/10 bg-black/25 p-5 text-[#e8d5c4]">
          All Server Station menus are turned off in FloBama OS Settings. Ask an admin to enable some.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          {tiles.map((tile) => (
            <ServerStationTile
              key={tile.key}
              href={tile.href}
              title={tile.title}
              description={tile.description}
              icon={tile.icon}
              accent={tile.accent}
            />
          ))}
        </div>
      )}
    </ServerStationShell>
  );
}
