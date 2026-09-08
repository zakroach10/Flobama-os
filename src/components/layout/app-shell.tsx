"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  ClapperboardIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MonitorPlayIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/events", label: "Events", icon: CalendarDaysIcon },
  { href: "/artists", label: "Artists", icon: UsersIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavLinks({
  onNavigate,
  className,
  showBooth,
}: {
  onNavigate?: () => void;
  className?: string;
  showBooth?: boolean;
}) {
  const pathname = usePathname();
  const items = showBooth
    ? [
        ...NAV.slice(0, 2),
        { href: "/booth", label: "Booth", icon: ClapperboardIcon },
        { href: "/screens", label: "Screens", icon: MonitorPlayIcon },
        ...NAV.slice(2),
      ]
    : NAV;
  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Staff">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-3 py-4">
      <Link href="/dashboard" className="block rounded-md focus-visible:outline-2">
        <p className="font-semibold tracking-tight text-sidebar-foreground">FloBama OS</p>
        <p className="text-xs text-sidebar-foreground/60">Staff operations</p>
      </Link>
    </div>
  );
}

export function AppShell({
  children,
  venueName,
  roleLabel,
  userLabel,
  showBooth = false,
}: {
  children: React.ReactNode;
  venueName: string;
  roleLabel: string;
  userLabel: string;
  showBooth?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <div className="flex-1 px-2">
          <NavLinks showBooth={showBooth} />
        </div>
        <div className="border-t border-sidebar-border px-4 py-4 text-xs text-sidebar-foreground/70">
          <p className="truncate font-medium text-sidebar-foreground">{venueName}</p>
          <p className="mt-1 truncate">{userLabel}</p>
          <p className="truncate">{roleLabel}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Open navigation" />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle className="text-sidebar-foreground">FloBama OS</SheetTitle>
              </SheetHeader>
              <div className="px-2 pb-6">
                <NavLinks showBooth={showBooth} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <p className="font-semibold">FloBama OS</p>
        </header>
        <div className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
