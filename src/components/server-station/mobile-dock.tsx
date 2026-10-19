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
    <>
      {sheet ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSheet(null)}
        />
      ) : null}

      {sheet ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sheetTitle}
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:hidden"
        >
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/12 bg-[#1a1613] shadow-[0_-20px_60px_rgba(0,0,0,0.55)]">
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
                      "flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2 text-left transition active:scale-[0.99]",
                      active ? "bg-[#d36b4a]/25 text-[#f7efe6]" : "text-[#f7efe6] hover:bg-white/5",
                    )}
                  >
                    <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-black/35">
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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <nav
          aria-label="Server Station"
          className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-1 rounded-full border border-white/12 bg-[#14110f]/92 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
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
        </nav>
      </div>
    </>
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
        "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[10px] font-semibold tracking-wide uppercase transition",
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
        "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[10px] font-semibold tracking-wide uppercase transition",
        emphasize && !pressed
          ? "bg-[#d36b4a] text-white shadow-[0_8px_24px_rgba(211,107,74,0.35)]"
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
