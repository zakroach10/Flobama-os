"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signOutAction } from "@/actions/records";
import { updateProfileAction, updateVenueAction } from "@/actions/records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffRole } from "@/lib/constants";
import { STAFF_ROLE_LABELS } from "@/lib/constants";

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
            <p className="text-xs text-muted-foreground">Roles are assigned with administrative SQL, not from this screen.</p>
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
