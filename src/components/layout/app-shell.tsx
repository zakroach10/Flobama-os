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
  SettingsIcon,
  Share2Icon,
  TicketIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from "lucide-react";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

function buildNavGroups({
  showScreens,
  showBooking,
  showSocial,
}: {
  showScreens?: boolean;
  showBooking?: boolean;
  showSocial?: boolean;
}): NavGroup[] {
  const programming: NavItem[] = [{ href: "/events", label: "Events", icon: CalendarDaysIcon }];
  if (showBooking) programming.push({ href: "/booking", label: "Booking", icon: ClipboardListIcon });
  if (showSocial) programming.push({ href: "/social", label: "Social", icon: Share2Icon });
  if (showScreens) programming.push({ href: "/screens", label: "Screens", icon: MonitorPlayIcon });

  return [
    {
      id: "home",
      label: "Home",
      items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon }],
    },
    {
      id: "programming",
      label: "Programming",
      items: programming,
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        { href: "/ticketing", label: "Ticketing", icon: TicketIcon },
        {
          href: "https://client.restaurantpos.spoton.com/b/",
          label: "SpotOn BOH",
          icon: UtensilsCrossedIcon,
          external: true,
        },
        { href: "/artists", label: "Artists", icon: UsersIcon },
      ],
    },
    {
      id: "workspace",
      label: "Workspace",
      items: [{ href: "/settings", label: "Settings", icon: SettingsIcon }],
    },
  ];
}

function NavLinks({
  onNavigate,
  className,
  showScreens,
  showBooking,
  showSocial,
}: {
  onNavigate?: () => void;
  className?: string;
  showScreens?: boolean;
  showBooking?: boolean;
  showSocial?: boolean;
}) {
  const pathname = usePathname();
  const groups = buildNavGroups({ showScreens, showBooking, showSocial });

  return (
    <nav className={cn("flex flex-col gap-5", className)} aria-label="Staff">
      {groups.map((group) => (
        <div key={group.id} className="space-y-1.5">
          <p className="px-3 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/45 uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              const className = cn(
                "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,transform] duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--sidebar-ring)_35%,transparent)]"
                  : "text-sidebar-foreground/78 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground",
              );

              const body = (
                <>
                  <span
                    className={cn(
                      "absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                    )}
                    aria-hidden
                  />
                  <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.external ? (
                    <ExternalLinkIcon className="size-3.5 shrink-0 opacity-55" aria-hidden />
                  ) : null}
                </>
              );

              return (
                <li key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onNavigate}
                      className={className}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link href={item.href} onClick={onNavigate} className={className} aria-current={active ? "page" : undefined}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-3 pt-5 pb-4">
      <Link href="/dashboard" className="block rounded-xl focus-visible:outline-2">
        <FlobamaLogo className="w-[168px]" />
        <p className="mt-2.5 text-[10px] font-semibold tracking-[0.2em] text-sidebar-foreground/55 uppercase">
          Staff OS
        </p>
      </Link>
    </div>
  );
}

function mobileSection(pathname: string) {
  if (pathname.startsWith("/events")) return "Events";
  if (pathname.startsWith("/booking")) return "Booking";
  if (pathname.startsWith("/social")) return "Social";
  if (pathname.startsWith("/ticketing")) return "Ticketing";
  if (pathname.startsWith("/artists")) return "Artists";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/screens")) return "Screens";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  return "Staff OS";
}

function UserFooter({
  venueName,
  userLabel,
  roleLabel,
}: {
  venueName: string;
  userLabel: string;
  roleLabel: string;
}) {
  return (
    <div className="border-t border-sidebar-border/80 px-4 py-4 text-xs text-sidebar-foreground/65">
      <p className="truncate font-medium text-sidebar-foreground">{venueName}</p>
      <p className="mt-1 truncate">{userLabel}</p>
      <p className="truncate text-sidebar-foreground/50">{roleLabel}</p>
    </div>
  );
}

export function AppShell({
  children,
  venueName,
  roleLabel,
  userLabel,
  showScreens = false,
  showBooking = false,
  showSocial = false,
}: {
  children: React.ReactNode;
  venueName: string;
  roleLabel: string;
  userLabel: string;
  showScreens?: boolean;
  showBooking?: boolean;
  showSocial?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-full bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_12%_-10%,color-mix(in_oklch,var(--brand)_14%,transparent),transparent_55%),radial-gradient(900px_500px_at_100%_0%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_50%)]"
        aria-hidden
      />
      <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-sidebar-border/40 bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <NavLinks showScreens={showScreens} showBooking={showBooking} showSocial={showSocial} />
        </div>
        <UserFooter venueName={venueName} userLabel={userLabel} roleLabel={roleLabel} />
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex min-h-14 items-center gap-3 border-b border-border/70 bg-card/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
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
              <div className="flex-1 overflow-y-auto px-2.5 pb-6">
                <NavLinks
                  showScreens={showScreens}
                  showBooking={showBooking}
                  showSocial={showSocial}
                  onNavigate={() => setOpen(false)}
                />
              </div>
              <UserFooter venueName={venueName} userLabel={userLabel} roleLabel={roleLabel} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <FlobamaLogo className="h-7 w-auto max-w-[132px]" />
            <p className="truncate text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {mobileSection(pathname)}
            </p>
          </div>
        </header>
        <div className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
