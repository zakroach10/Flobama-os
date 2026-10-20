"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  CakeIcon,
  CalendarDaysIcon,
  HomeIcon,
  LayoutGridIcon,
  LockIcon,
  MessageSquareTextIcon,
  MonitorPlayIcon,
  Music2Icon,
  SmartphoneIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from "lucide-react";
import { ServerStationHeaderMeta } from "@/components/server-station/header-meta";
import { ServerStationPosRail } from "@/components/server-station/pos-rail";
import { ServerStationMobileDock } from "@/components/server-station/mobile-dock";
import { getServerStationDashboardAction } from "@/actions/server-station";
import {
  lockServerStationStaffAction,
  refreshServerStationStaffSessionAction,
} from "@/actions/server-station-auth";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { cn } from "@/lib/utils";
import { StationLink, useStationNav } from "@/components/server-station/station-nav";
import { wallStatusLabel, type ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

const STATION_MENUS: Array<{ href: string; label: string; icon: LucideIcon; exact?: boolean }> = [
  { href: "/server", label: "Home", icon: LayoutGridIcon, exact: true },
  { href: "/server/events", label: "Events", icon: CalendarDaysIcon },
  { href: "/server/wall", label: "Wall", icon: MonitorPlayIcon },
  { href: "/server/performances", label: "Shows", icon: Music2Icon },
  { href: "/server/specials", label: "Specials", icon: UtensilsCrossedIcon },
  { href: "/server/birthday", label: "Celebrate", icon: CakeIcon },
  { href: "/server/message", label: "Message", icon: MessageSquareTextIcon },
  { href: "/server/upload", label: "Upload", icon: SmartphoneIcon },
];

function menuIsActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ServerStationShell({
  children,
  title,
  actorName,
  wall,
  showBack = true,
  /** Fixed kiosk viewport — content must fit without page scrolling (POS wall grid). */
  layout = "scroll",
}: {
  children: React.ReactNode;
  title?: string;
  actorName: string;
  wall: ServerStationWallStatus;
  showBack?: boolean;
  layout?: "scroll" | "pos";
}) {
  const pathname = usePathname();
  const nav = useStationNav();
  const path = nav?.path ?? pathname;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liveWall, setLiveWall] = useState(wall);
  useEffect(() => {
    setLiveWall(wall);
  }, [wall]);
  const atHome = path === "/server";
  const pos = layout === "pos";

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const bump = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        startTransition(async () => {
          await lockServerStationStaffAction();
          router.replace("/server/login?reason=idle");
        });
      }, 3 * 60_000);
    };
    bump();
    // Keep the httpOnly staff cookie alive while the kiosk is in use.
    // Page renders cannot write cookies in Next.js; this Server Action can.
    void refreshServerStationStaffSessionAction();
    heartbeat = setInterval(() => {
      void refreshServerStationStaffSessionAction();
    }, 60_000);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const wallPoll = window.setInterval(() => {
      void getServerStationDashboardAction().then((result) => {
        if (result.ok) setLiveWall(result.wall);
      });
    }, 10_000);
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (heartbeat) clearInterval(heartbeat);
      window.clearInterval(wallPoll);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [router]);

  return (
    <div
      className={cn(
        "dark bg-[radial-gradient(ellipse_at_top,_rgba(211,107,74,0.16),_transparent_50%),linear-gradient(180deg,_#14110f_0%,_#1a1613_45%,_#100e0c_100%)] text-foreground",
        "absolute inset-0 flex flex-col overflow-hidden overscroll-none",
      )}
    >
      <header
        className={cn(
          "z-40 shrink-0 bg-[#14110f] px-3 pt-[env(safe-area-inset-top)] sm:border-b sm:border-white/10 sm:bg-black/40 sm:px-4 sm:backdrop-blur-md",
          "relative",
        )}
      >
        <div className="mx-auto flex w-full min-h-12 items-center gap-2 py-2 sm:min-h-16 sm:gap-3 sm:py-3">
          {showBack && !atHome ? (
            <StationLink
              href="/server"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-base font-semibold sm:min-h-16 sm:min-w-16"
            >
              <ArrowLeftIcon className="size-5 sm:size-6" aria-hidden />
              <span className="sr-only">Back</span>
            </StationLink>
          ) : null}
          <div className="min-w-0 flex-1">
            <FlobamaLogo className="h-6 w-auto max-w-[110px] brightness-110 sm:h-8 sm:max-w-[150px]" priority />
            <p className="truncate text-[10px] font-semibold tracking-[0.18em] text-[#e8d5c4] uppercase sm:text-xs">
              {title || "Server Station"}
            </p>
            <ServerStationHeaderMeta className="mt-0.5 text-left sm:hidden" />
            <p
              className={cn(
                "truncate text-[11px] font-semibold sm:hidden",
                liveWall.connected ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {liveWall.connected ? "Wall online" : "Wall offline"}
              {liveWall.currentlyPlaying ? ` · ${liveWall.currentlyPlaying}` : ""}
            </p>
          </div>
          <div className="hidden min-w-0 max-w-[18rem] text-right sm:block lg:max-w-[22rem]">
            <ServerStationHeaderMeta />
            <p className="mt-0.5 truncate text-xs font-medium text-[#e8d5c4]/90">{actorName}</p>
            <p
              className={cn(
                "truncate text-xs font-semibold",
                liveWall.connected ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {wallStatusLabel(liveWall)}
              {liveWall.currentlyPlaying ? ` · ${liveWall.currentlyPlaying}` : null}
            </p>
          </div>
          <StationLink
            href="/server"
            className="hidden min-h-16 min-w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5 lg:inline-flex"
            ariaLabel="Home"
          >
            <HomeIcon className="size-6" />
          </StationLink>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await lockServerStationStaffAction();
                router.replace("/server/login");
              });
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 sm:min-h-16 sm:min-w-16"
            aria-label="Lock"
          >
            <LockIcon className="size-6" />
          </button>
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full flex-1 gap-3 overflow-hidden px-3 pt-3 lg:px-4 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <nav
          aria-label="Server Station"
          className="hidden min-h-0 w-[5.75rem] shrink-0 flex-col gap-2 overflow-y-auto lg:flex"
        >
          {STATION_MENUS.map((item) => {
            const active = menuIsActive(path, item.href, item.exact);
            const Icon = item.icon;
            return (
              <StationLink
                key={item.href}
                href={item.href}
                ariaCurrent={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-[11px] font-semibold",
                  active
                    ? "border-[#d36b4a]/60 bg-[#d36b4a]/25 text-[#f7efe6]"
                    : "border-white/10 bg-white/5 text-[#e8d5c4]",
                )}
              >
                <Icon className="size-6" aria-hidden />
                {item.label}
              </StationLink>
            );
          })}
        </nav>
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain",
            pos && "lg:flex lg:flex-col lg:overflow-hidden",
          )}
        >
          {children}
        </main>
        <aside className="hidden h-full w-[22.5rem] shrink-0 lg:block">
          <ServerStationPosRail />
        </aside>
      </div>
      <ServerStationMobileDock />
    </div>
  );
}

export function ServerStationTile({
  href,
  title,
  description,
  icon: Icon,
  accent = "warm",
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: "warm" | "cool" | "gold" | "rose";
}) {
  const accents = {
    warm: "from-[#d36b4a]/25 to-transparent border-[#d36b4a]/40",
    cool: "from-sky-500/20 to-transparent border-sky-400/30",
    gold: "from-amber-400/20 to-transparent border-amber-300/30",
    rose: "from-fuchsia-500/20 to-transparent border-fuchsia-300/30",
  } as const;

  return (
    <StationLink
      href={href}
      className={cn(
        "flex min-h-[7.5rem] flex-col justify-between rounded-2xl border bg-gradient-to-br p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition active:scale-[0.98] lg:min-h-[132px] lg:rounded-[28px] lg:p-5",
        accents[accent],
      )}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-black/30 text-[#f7efe6] lg:size-12 lg:rounded-2xl">
        <Icon className="size-5 lg:size-7" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-bold tracking-tight text-[#f7efe6] lg:text-2xl">{title}</h2>
        <p className="mt-1 line-clamp-2 text-xs text-[#e8d5c4]/90 lg:text-sm">{description}</p>
      </div>
    </StationLink>
  );
}

export function ServerStationButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-16 items-center justify-center rounded-2xl px-6 text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-[#d36b4a] text-white",
        variant === "secondary" && "border border-white/20 bg-white/10 text-[#f7efe6]",
        variant === "danger" && "bg-red-700 text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ServerStationField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">{label}</span>
      {children}
    </label>
  );
}

export const serverStationInputClass =
  "min-h-16 w-full rounded-2xl border border-white/15 bg-black/30 px-4 text-xl text-[#f7efe6] outline-none focus:border-[#d36b4a]";
