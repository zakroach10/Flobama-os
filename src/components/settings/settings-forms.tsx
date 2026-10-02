"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { MoonIcon, SunIcon } from "lucide-react";
import { signOutAction } from "@/actions/records";
import { updateProfileAction, updateVenueAction } from "@/actions/records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffRole } from "@/lib/constants";
import { STAFF_ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SettingsForms({
  displayName,
  venueName,
  timeZone,
  role,
  email,
}: {
  displayName: string;
  venueName: string;
  timeZone: string;
  role: StaffRole;
  email: string | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(displayName);
  const [venue, setVenue] = useState(venueName);

  return (
    <div className="space-y-10">
      <AppearanceSettings />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your profile</h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await updateProfileAction({ displayName: name });
              if (!result.ok) toast.error(result.message);
              else toast.success(result.message);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email ?? ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={STAFF_ROLE_LABELS[role]} readOnly />
            <p className="text-xs text-muted-foreground">
              Your role is assigned by an admin. You cannot raise it from this screen.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            Save display name
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Venue</h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await updateVenueAction({ name: venue });
              if (!result.ok) toast.error(result.message);
              else toast.success(result.message);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="venueName">Venue name</Label>
            <Input
              id="venueName"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              readOnly={role !== "admin"}
            />
            {role !== "admin" ? (
              <p className="text-xs text-muted-foreground">Only admins can rename the venue.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timeZone} readOnly />
            <p className="text-xs text-muted-foreground">Fixed to America/Chicago for this milestone.</p>
          </div>
          {role === "admin" ? (
            <Button type="submit" disabled={pending}>
              Save venue name
            </Button>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Session</h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            startTransition(async () => {
              await signOutAction();
            });
          }}
        >
          Log out
        </Button>
      </section>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? (theme === "dark" || resolvedTheme === "dark" ? "dark" : "light") : "light";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Choose light or dark for your staff screens. Saved on this device.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={active === "light"}
          disabled={!mounted}
          onClick={() => setTheme("light")}
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition-colors",
            active === "light"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card hover:bg-muted/50",
          )}
        >
          <SunIcon className="size-5 shrink-0" aria-hidden />
          <span>
            <span className="block font-medium">Light</span>
            <span className="block text-xs text-muted-foreground">Default FloBama look</span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={active === "dark"}
          disabled={!mounted}
          onClick={() => setTheme("dark")}
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition-colors",
            active === "dark"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card hover:bg-muted/50",
          )}
        >
          <MoonIcon className="size-5 shrink-0" aria-hidden />
          <span>
            <span className="block font-medium">Dark</span>
            <span className="block text-xs text-muted-foreground">Low-light control rooms</span>
          </span>
        </button>
      </div>
    </section>
  );
}
