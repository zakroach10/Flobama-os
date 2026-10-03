"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  clearAudienceCornerSponsorAction,
  saveAudienceCornerSponsorAction,
} from "@/actions/audience";
import { uploadAudienceCornerSponsorFromBrowser } from "@/lib/audience/corner-sponsor-upload";
import { AUDIENCE_CORNER_SPONSOR_SQL } from "@/lib/constants";
import type { AudienceCornerPosition } from "@/lib/audience/types";
import type { StaffAudienceSettings } from "@/lib/queries/audience";
import type { PublicSupabaseEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CornerSponsorPanel({
  settings,
  venueId,
  supabaseEnv,
  missingColumns,
  onChanged,
}: {
  settings: StaffAudienceSettings;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  missingColumns?: boolean;
  onChanged: () => void;
}) {
  const sponsor = settings.cornerSponsor;
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(sponsor.name);

  const hasSponsor = Boolean(sponsor.name || sponsor.imageUrl);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        onChanged();
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-24 min-w-40 items-center justify-center gap-3 rounded-2xl bg-[#07090d] px-4 py-3 text-white">
          {sponsor.imageUrl ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sponsor.imageUrl} alt="" className="max-h-14 max-w-14 object-contain" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">
              Presented by
            </span>
            <span className="block truncate text-sm font-black">{sponsor.name || "Sponsor"}</span>
          </span>
        </div>
        <div className="min-w-[16rem] flex-1 space-y-3">
          <div>
            <p className="font-medium">Corner sponsor</p>
            <p className="text-sm text-muted-foreground">
              Stays in a corner of the LED wall while polls, questions, and other cards stay on screen.
            </p>
          </div>
          {missingColumns ? (
            <p className="text-sm text-amber-800">
              Apply {AUDIENCE_CORNER_SPONSOR_SQL} in the Supabase SQL editor, then refresh.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="corner-sponsor-logo">Logo (PNG, JPG, or WebP)</Label>
                <Input
                  id="corner-sponsor-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    startTransition(async () => {
                      const result = await uploadAudienceCornerSponsorFromBrowser({
                        file,
                        venueId,
                        supabaseEnv,
                      });
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        onChanged();
                      }
                    });
                  }}
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 space-y-1">
                  <Label htmlFor="corner-sponsor-name">Name on the wall</Label>
                  <Input
                    id="corner-sponsor-name"
                    value={name}
                    maxLength={80}
                    disabled={pending}
                    placeholder="Sponsor name"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || name.trim() === sponsor.name}
                  onClick={() => run(async () => saveAudienceCornerSponsorAction({ name }))}
                >
                  Save name
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Corner</span>
                {(
                  [
                    ["bottom-left", "Bottom left"],
                    ["bottom-right", "Bottom right"],
                  ] as const
                ).map(([corner, label]) => (
                  <Button
                    key={corner}
                    type="button"
                    size="sm"
                    variant={sponsor.corner === corner ? "default" : "outline"}
                    disabled={pending}
                    onClick={() =>
                      run(async () =>
                        saveAudienceCornerSponsorAction({ corner: corner satisfies AudienceCornerPosition }),
                      )
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending || (!sponsor.enabled && !hasSponsor && !name.trim())}
                  variant={sponsor.enabled ? "secondary" : "default"}
                  onClick={() =>
                    run(async () =>
                      saveAudienceCornerSponsorAction({
                        enabled: !sponsor.enabled,
                        name: name.trim() || sponsor.name,
                      }),
                    )
                  }
                >
                  {sponsor.enabled ? "Hide from LED wall" : "Show on LED wall"}
                </Button>
                {hasSponsor ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(async () => clearAudienceCornerSponsorAction())}
                  >
                    Remove sponsor
                  </Button>
                ) : null}
              </div>
              <p className={cn("text-xs", sponsor.enabled ? "text-emerald-700" : "text-muted-foreground")}>
                {sponsor.enabled
                  ? `Showing in the ${sponsor.corner === "bottom-right" ? "bottom right" : "bottom left"} while the audience wall is up.`
                  : "Hidden until you show it. Other wall content is unchanged."}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
