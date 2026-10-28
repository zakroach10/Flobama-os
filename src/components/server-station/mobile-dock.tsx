"use client";

import { useEffect, useState } from "react";
import {
  CakeIcon,
  CalendarDaysIcon,
  ClapperboardIcon,
  HomeIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  MoreHorizontalIcon,
  Music2Icon,
  PlusIcon,
  SmartphoneIcon,
  UtensilsCrossedIcon,
  XIcon,
  TvMinimalPlayIcon,
  type LucideIcon,
} from "lucide-react";
import { StationLink, useStationNav } from "@/components/server-station/station-nav";
import {
  isServerStationMenuEnabled,
  type ServerStationMenuKey,
} from "@/lib/server-station/features";
import { cn } from "@/lib/utils";

type SheetId = "create" | "more" | null;

const CREATE_ITEMS: Array<{
  key: ServerStationMenuKey;
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    key: "specials",
    href: "/server/specials",
    label: "Food & drink",
    hint: "Promo slides for the wall",
    icon: UtensilsCrossedIcon,
  },
  {
    key: "birthday",
    href: "/server/birthday",
    label: "Celebration",
    hint: "Birthday, anniversary, shout-out",
    icon: CakeIcon,
  },
  {
    key: "message",
    href: "/server/message",
    label: "Message",
    hint: "Short announcement graphic",
    icon: MessageSquareTextIcon,
  },
  {
    key: "upload",
    href: "/server/upload",
    label: "Phone upload",
    hint: "Temp library · Set on Wall",
    icon: SmartphoneIcon,
  },
  {
    key: "youtube",
    href: "/server/youtube",
    label: "YouTube",
    hint: "Play a link, then back to normal",
    icon: TvMinimalPlayIcon,
  },
];

const MORE_ITEMS: Array<{
  key: ServerStationMenuKey;
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    key: "events",
    href: "/server/events",
    label: "Tonight",
    hint: "Schedules and guest questions",
    icon: CalendarDaysIcon,
  },
  {
    key: "performances",
    href: "/server/performances",
    label: "Shows",
    hint: "Play published performances",
    icon: Music2Icon,
  },
  {
    key: "active",
    href: "/server/active",
    label: "Rotation",
    hint: "What’s live or queued",
    icon: ClapperboardIcon,
  },
];

function pathMatches(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useStandaloneDisplay() {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const iosStandalone =
      "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const sync = () => setStandalone(media.matches || iosStandalone);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return standalone;
}

/**
 * Edge-to-edge bottom tab bar.
 * Icons sit near the home indicator; safe-area padding only applies in
 * installed standalone mode (Safari already clears the home indicator).
 */
export function ServerStationMobileDock() {
  const nav = useStationNav();
  const path = nav?.path ?? "/server";
  const menus = nav?.session.menusEnabled;
  const standalone = useStandaloneDisplay();
  const [sheet, setSheet] = useState<SheetId>(null);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  function closeSheet() {
    setSheet(null);
  }

  const createItems = CREATE_ITEMS.filter((item) => isServerStationMenuEnabled(menus, item.key));
  const moreItems = MORE_ITEMS.filter((item) => isServerStationMenuEnabled(menus, item.key));
  const wallEnabled = isServerStationMenuEnabled(menus, "wall");

  const createOpen = sheet === "create";
  const moreOpen = sheet === "more";
  const createActive = createItems.some((item) => pathMatches(path, item.href));
  const moreActive = moreItems.some((item) => pathMatches(path, item.href));
  const homeActive = pathMatches(path, "/server", true);
  const wallActive = pathMatches(path, "/server/wall");

  const sheetItems = sheet === "create" ? createItems : sheet === "more" ? moreItems : [];
  const sheetTitle = sheet === "create" ? "Put something on the wall" : sheet === "more" ? "More" : "";

  return (
    <div className="relative z-50 shrink-0 lg:hidden">
      {sheet ? (
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-x-0 bottom-full z-40 h-screen bg-black/55"
          onClick={() => setSheet(null)}
        />
      ) : null}

      {sheet ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sheetTitle}
          className="absolute inset-x-0 bottom-full z-50 px-3 pb-2"
        >
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-[24px] border border-white/12 bg-[#1a1613] shadow-[0_-16px_48px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">{sheetTitle}</p>
              <button
                type="button"
                onClick={() => setSheet(null)}
                className="inline-flex size-10 items-center justify-center rounded-full bg-white/5 text-[#f7efe6]"
                aria-label="Close"
              >
                <XIcon className="size-5" aria-hidden />
              </button>
            </div>
            <div className="grid gap-1 p-2">
              {sheetItems.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[#e8d5c4]">
                  These menus are turned off in FloBama OS Settings.
                </p>
              ) : null}
              {sheetItems.map((item) => {
                const Icon = item.icon;
                const active = pathMatches(path, item.href);
                return (
                  <StationLink
                    key={item.href}
                    href={item.href}
                    ariaCurrent={active ? "page" : undefined}
                    onNavigate={closeSheet}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-left transition active:scale-[0.99]",
                      active ? "bg-[#d36b4a]/25 text-[#f7efe6]" : "text-[#f7efe6] hover:bg-white/5",
                    )}
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-black/35">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-[#e8d5c4]/85">{item.hint}</span>
                    </span>
                  </StationLink>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Server Station"
        className="border-t border-white/10 bg-[#100e0c] pt-1"
        style={{
          // Sit almost on the home indicator — only a couple pixels of clearance.
          paddingBottom: standalone
            ? "max(0.125rem, calc(env(safe-area-inset-bottom, 0px) - 1.85rem))"
            : "0.125rem",
        }}
      >
        <div className={cn("grid h-9", wallEnabled ? "grid-cols-4" : "grid-cols-3")}>
          <DockLink href="/server" label="Home" icon={HomeIcon} active={homeActive} onNavigate={closeSheet} />
          <DockButton
            label="Create"
            icon={PlusIcon}
            active={createActive || createOpen}
            pressed={createOpen}
            onClick={() => setSheet(createOpen ? null : "create")}
            emphasize
            disabled={createItems.length === 0}
          />
          {wallEnabled ? (
            <DockLink
              href="/server/wall"
              label="Wall"
              icon={MonitorPlayIcon}
              active={wallActive}
              onNavigate={closeSheet}
            />
          ) : null}
          <DockButton
            label="More"
            icon={MoreHorizontalIcon}
            active={moreActive || moreOpen}
            pressed={moreOpen}
            onClick={() => setSheet(moreOpen ? null : "more")}
            disabled={moreItems.length === 0}
          />
        </div>
      </nav>
    </div>
  );
}

function DockLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <StationLink
      href={href}
      ariaCurrent={active ? "page" : undefined}
      ariaLabel={label}
      onNavigate={onNavigate}
      className={cn(
        "flex h-full min-w-0 flex-col items-center justify-end gap-0 text-[10px] font-semibold tracking-wide uppercase",
        active ? "text-[#f7efe6]" : "text-[#e8d5c4]/75",
      )}
    >
      <Icon className={cn("size-5", active ? "text-[#d36b4a]" : "text-current")} aria-hidden />
      {label}
    </StationLink>
  );
}

function DockButton({
  label,
  icon: Icon,
  active,
  pressed,
  onClick,
  emphasize,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  pressed: boolean;
  onClick: () => void;
  emphasize?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-full min-w-0 flex-col items-center justify-end gap-0 text-[10px] font-semibold tracking-wide uppercase disabled:opacity-40",
        pressed || active ? "text-[#f7efe6]" : emphasize ? "text-[#f0a58a]" : "text-[#e8d5c4]/75",
      )}
    >
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full",
          emphasize && !pressed ? "bg-[#d36b4a] text-white" : pressed || active ? "bg-white/10" : "",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      {label}
    </button>
  );
}
