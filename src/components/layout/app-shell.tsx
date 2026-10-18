"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MonitorPlayIcon,
  RadioIcon,
  SettingsIcon,
  Share2Icon,
  StoreIcon,
  TicketIcon,
  UsersIcon,
  UtensilsCrossedIcon,
  VideoIcon,
} from "lucide-react";
import { signOutAction, signOutWallOpsAction } from "@/actions/records";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isAudienceOnlyShell, isWallOpsShell, STAFF_MENUS, type StaffMenuId } from "@/lib/auth/menus";
import { cn } from "@/lib/utils";
import { useState } from "react";

const MENU_ICONS = {
  dashboard: LayoutDashboardIcon,
  programming: CalendarDaysIcon,
  booking: ClipboardListIcon,
  social: Share2Icon,
  audience: RadioIcon,
  screens: MonitorPlayIcon,
  cameras: VideoIcon,
  ticketing: TicketIcon,
  spoton: UtensilsCrossedIcon,
  artists: UsersIcon,
  settings: SettingsIcon,
  server: StoreIcon,
} as const;

function NavLinks({
  onNavigate,
  className,
  menus,
}: {
  onNavigate?: () => void;
  className?: string;
  menus: readonly StaffMenuId[];
}) {
  const pathname = usePathname();
  const enabled = new Set(menus);
  const items = STAFF_MENUS.filter((item) => enabled.has(item.id));
  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Staff">
      {items.map((item) => {
        const external = Boolean(item.external);
        const active = !external && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        const Icon = MENU_ICONS[item.id];
        const className = cn(
          "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        );
        if (external) {
          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={className}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
            </a>
          );
        }
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={className}>
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ homeHref }: { homeHref: string }) {
  return (
    <div className="px-3 py-3">
      <Link href={homeHref} className="block rounded-md focus-visible:outline-2">
        <FlobamaLogo className="w-[148px]" />
        <p className="mt-1 text-[11px] font-semibold tracking-[0.18em] text-sidebar-foreground/70 uppercase">Staff OS</p>
      </Link>
    </div>
  );
}

function mobileSection(pathname: string) {
  if (pathname.startsWith("/programming") || pathname.startsWith("/events")) return "Programming";
  if (pathname.startsWith("/booking")) return "Booking";
  if (pathname.startsWith("/social")) return "Social";
  if (pathname.startsWith("/audience")) return "Audience";
  if (pathname.startsWith("/ticketing")) return "Ticketing";
  if (pathname.startsWith("/artists")) return "Artists";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/server")) return "Server Station";
  if (pathname.startsWith("/screens")) return "Screens";
  if (pathname.startsWith("/cameras")) return "Cameras";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  return "Staff OS";
}

function AccountFooter({
  venueName,
  roleLabel,
  userLabel,
}: {
  venueName: string;
  roleLabel: string;
  userLabel: string;
}) {
  return (
    <div className="border-t border-sidebar-border px-3 py-3 text-xs text-sidebar-foreground/70">
      <p className="truncate font-medium text-sidebar-foreground">{venueName}</p>
      <p className="truncate">{userLabel}</p>
      <p className="truncate">{roleLabel}</p>
      <form action={signOutAction} className="mt-2">
        <button
          type="submit"
          className="flex min-h-9 w-full items-center justify-center rounded-lg border border-sidebar-border px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/70"
        >
          Log out
        </button>
      </form>
    </div>
  );
}

function DedicatedConsoleShell({
  children,
  venueName,
  roleLabel,
  userLabel,
  consoleLabel,
  dark = false,
  dense = false,
  bare = false,
  wallOpsSignOut = false,
}: {
  children: React.ReactNode;
  venueName: string;
  roleLabel: string;
  userLabel: string;
  consoleLabel: string;
  dark?: boolean;
  dense?: boolean;
  /** When true, skip the chrome header — the page owns branding and logout. */
  bare?: boolean;
  wallOpsSignOut?: boolean;
}) {
  const logoutAction = wallOpsSignOut ? signOutWallOpsAction : signOutAction;

  if (bare) {
    return (
      <div
        className={cn(
          "flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground",
          dark && "dark",
          "bg-[radial-gradient(ellipse_at_top,_rgba(196,86,48,0.12),_transparent_55%),linear-gradient(180deg,_#141210_0%,_#1c1916_40%,_#12100e_100%)]",
        )}
      >
        <div
          className={cn(
            "mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden text-foreground",
            dense
              ? "max-w-[90rem] px-2 py-2 sm:px-3 sm:py-2 lg:px-4"
              : "max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8",
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-full flex-col bg-background text-foreground", dark && "dark")}>
      <header
        className={cn(
          "sticky top-0 z-40 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm",
          dark && "border-border/70 bg-card/90",
        )}
      >
        <div
          className={cn(
            "mx-auto flex min-h-14 items-center gap-3 px-4 sm:px-6",
            dense ? "max-w-[90rem] lg:px-5" : "max-w-6xl lg:px-8",
          )}
        >
          <div className="min-w-0 flex-1">
            <FlobamaLogo className={cn("h-7 w-auto max-w-[132px]", dark && "brightness-110")} />
            <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {consoleLabel}
            </p>
          </div>
          <div className="hidden min-w-0 text-right text-xs text-muted-foreground sm:block">
            <p className="truncate font-medium text-foreground">{userLabel}</p>
            <p className="truncate">
              {roleLabel} · {venueName}
            </p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="text-foreground">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <div
        className={cn(
          "mx-auto w-full flex-1 overflow-x-hidden text-foreground pb-[max(1rem,env(safe-area-inset-bottom))]",
          dense
            ? "max-w-[90rem] px-3 py-3 sm:px-4 sm:py-3 lg:px-5"
            : "max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  venueName,
  roleLabel,
  userLabel,
  menus,
  homeHref,
}: {
  children: React.ReactNode;
  venueName: string;
  roleLabel: string;
  userLabel: string;
  menus: readonly StaffMenuId[];
  homeHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (isAudienceOnlyShell(menus)) {
    return (
      <DedicatedConsoleShell
        venueName={venueName}
        roleLabel={roleLabel}
        userLabel={userLabel}
        consoleLabel="Audience console"
      >
        {children}
      </DedicatedConsoleShell>
    );
  }

  if (isWallOpsShell(menus)) {
    return (
      <DedicatedConsoleShell
        venueName={venueName}
        roleLabel={roleLabel}
        userLabel={userLabel}
        consoleLabel="Wall & Screens"
        dark
        dense
        bare
        wallOpsSignOut
      >
        {children}
      </DedicatedConsoleShell>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
      <aside className="hidden w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Brand homeHref={homeHref} />
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <NavLinks menus={menus} />
        </div>
        <AccountFooter venueName={venueName} roleLabel={roleLabel} userLabel={userLabel} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex min-h-14 items-center gap-3 border-b bg-card/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-sm md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Open navigation" />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar p-0 text-sidebar-foreground data-[side=left]:w-[min(20rem,88vw)]">
              <SheetHeader>
                <SheetTitle className="sr-only">FloBama OS</SheetTitle>
                <FlobamaLogo className="mx-auto w-[180px] max-w-[70%]" />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-2 pb-6">
                <NavLinks menus={menus} onNavigate={() => setOpen(false)} />
              </div>
              <AccountFooter venueName={venueName} roleLabel={roleLabel} userLabel={userLabel} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <FlobamaLogo className="h-7 w-auto max-w-[132px]" />
            <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {mobileSection(pathname)}
            </p>
          </div>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 lg:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}
