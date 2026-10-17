"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { HomeIcon, ArrowLeftIcon, LockIcon } from "lucide-react";
import {
  lockServerStationStaffAction,
  refreshServerStationStaffSessionAction,
} from "@/actions/server-station-auth";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { cn } from "@/lib/utils";
import { wallStatusLabel, type ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

export function ServerStationShell({
  children,
  title,
  actorName,
  wall,
  showBack = true,
}: {
  children: React.ReactNode;
  title?: string;
  actorName: string;
  wall: ServerStationWallStatus;
  showBack?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const atHome = pathname === "/server";

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
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (heartbeat) clearInterval(heartbeat);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [router]);

  return (
    <div className="dark min-h-full bg-[radial-gradient(ellipse_at_top,_rgba(211,107,74,0.16),_transparent_50%),linear-gradient(180deg,_#14110f_0%,_#1a1613_45%,_#100e0c_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl min-h-16 items-center gap-3 py-3">
          {showBack && !atHome ? (
            <Link
              href="/server"
              className="inline-flex min-h-16 min-w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-base font-semibold"
            >
              <ArrowLeftIcon className="size-6" aria-hidden />
              <span className="sr-only">Back</span>
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <FlobamaLogo className="h-8 w-auto max-w-[150px] brightness-110" priority />
            <p className="truncate text-xs font-semibold tracking-[0.18em] text-[#e8d5c4]/uppercase">
              {title || "Server Station"}
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-[#f7efe6]">{actorName}</p>
            <p
              className={cn(
                "text-xs font-semibold",
                wall.connected ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {wallStatusLabel(wall)}
              {wall.currentlyPlaying ? ` · ${wall.currentlyPlaying}` : null}
            </p>
          </div>
          <Link
            href="/server"
            className="inline-flex min-h-16 min-w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5"
            aria-label="Home"
          >
            <HomeIcon className="size-6" />
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await lockServerStationStaffAction();
                router.replace("/server/login");
              });
            }}
            className="inline-flex min-h-16 min-w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5"
            aria-label="Lock"
          >
            <LockIcon className="size-6" />
          </button>
        </div>
        <div className="mx-auto max-w-6xl pb-3 sm:hidden">
          <p
            className={cn(
              "text-sm font-semibold",
              wall.connected ? "text-emerald-300" : "text-amber-300",
            )}
          >
            {wallStatusLabel(wall)}
            {wall.currentlyPlaying ? ` · Currently Playing: ${wall.currentlyPlaying}` : null}
          </p>
          {!wall.connected && wall.offlineReason ? (
            <p className="mt-1 text-sm text-amber-100/90">{wall.offlineReason}</p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </main>
    </div>
  );
}

export function ServerStationTile({
  href,
  title,
  description,
  accent = "warm",
}: {
  href: string;
  title: string;
  description: string;
  accent?: "warm" | "cool" | "gold" | "rose";
}) {
  const accents = {
    warm: "from-[#d36b4a]/25 to-transparent border-[#d36b4a]/40",
    cool: "from-sky-500/20 to-transparent border-sky-400/30",
    gold: "from-amber-400/20 to-transparent border-amber-300/30",
    rose: "from-fuchsia-500/20 to-transparent border-fuchsia-300/30",
  } as const;

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[148px] flex-col justify-end rounded-[28px] border bg-gradient-to-br p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition active:scale-[0.98]",
        accents[accent],
      )}
    >
      <h2 className="text-2xl font-bold tracking-tight text-[#f7efe6] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-base text-[#e8d5c4]/90">{description}</p>
    </Link>
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
