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
  type LucideIcon,
} from "lucide-react";
import { StationLink, useStationNav } from "@/components/server-station/station-nav";
import { cn } from "@/lib/utils";

type SheetId = "create" | "more" | null;

const CREATE_ITEMS: Array<{ href: string; label: string; hint: string; icon: LucideIcon }> = [
  {
    href: "/server/specials",
    label: "Food & drink",
    hint: "Promo slides for the wall",
    icon: UtensilsCrossedIcon,
  },
  {
    href: "/server/birthday",
    label: "Celebration",
    hint: "Birthday, anniversary, shout-out",
    icon: CakeIcon,
  },
  {
    href: "/server/message",
    label: "Message",
    hint: "Short announcement graphic",
    icon: MessageSquareTextIcon,
  },
  {
    href: "/server/upload",
    label: "Phone upload",
    hint: "Guest photo via QR",
    icon: SmartphoneIcon,
  },
];

const MORE_ITEMS: Array<{ href: string; label: string; hint: string; icon: LucideIcon }> = [
  {
    href: "/server/events",
    label: "Tonight",
    hint: "Schedules and guest questions",
    icon: CalendarDaysIcon,
  },
  {
    href: "/server/performances",
    label: "Shows",
    hint: "Play published performances",
    icon: Music2Icon,
  },
  {
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

/**
 * Bottom-anchored Server Station dock for phone/PWA.
 * Must stay in normal flex flow (not position:fixed) so iOS visual-viewport
 * rubber-banding cannot drag it around inside the fixed station shell.
 */
export function ServerStationMobileDock() {
  const nav = useStationNav();
  const path = nav?.path ?? "/server";
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

  const createOpen = sheet === "create";
  const moreOpen = sheet === "more";
  const createActive = CREATE_ITEMS.some((item) => pathMatches(path, item.href));
  const moreActive = MORE_ITEMS.some((item) => pathMatches(path, item.href));
  const homeActive = pathMatches(path, "/server", true);
  const wallActive = pathMatches(path, "/server/wall");

  const sheetItems = sheet === "create" ? CREATE_ITEMS : sheet === "more" ? MORE_ITEMS : [];
  const sheetTitle = sheet === "create" ? "Put something on the wall" : sheet === "more" ? "More" : "";

  return (
    <div className="relative z-50 shrink-0 lg:hidden">
      {sheet ? (
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-x-0 bottom-full z-40 h-[100dvh] bg-black/55 backdrop-blur-[2px]"
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
        className="border-t border-white/10 bg-[#100e0c] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="mx-auto flex w-full max-w-lg items-stretch gap-0.5 px-1 pt-1">
          <DockLink href="/server" label="Home" icon={HomeIcon} active={homeActive} onNavigate={closeSheet} />
          <DockButton
            label="Create"
            icon={PlusIcon}
            active={createActive || createOpen}
            pressed={createOpen}
            onClick={() => setSheet(createOpen ? null : "create")}
            emphasize
          />
          <DockLink href="/server/wall" label="Wall" icon={MonitorPlayIcon} active={wallActive} onNavigate={closeSheet} />
          <DockButton
            label="More"
            icon={MoreHorizontalIcon}
            active={moreActive || moreOpen}
            pressed={moreOpen}
            onClick={() => setSheet(moreOpen ? null : "more")}
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
        "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-semibold tracking-wide uppercase",
        active ? "bg-white/10 text-[#f7efe6]" : "text-[#e8d5c4]/80",
      )}
    >
      <Icon className={cn("size-5", active && "text-[#d36b4a]")} aria-hidden />
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
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  pressed: boolean;
  onClick: () => void;
  emphasize?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-semibold tracking-wide uppercase",
        emphasize && !pressed
          ? "bg-[#d36b4a] text-white"
          : active || pressed
            ? "bg-white/10 text-[#f7efe6]"
            : "text-[#e8d5c4]/80",
      )}
    >
      <Icon className={cn("size-5", emphasize && !pressed && "text-white")} aria-hidden />
      {label}
    </button>
  );
}
