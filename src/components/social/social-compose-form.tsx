"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createWeekSocialPostAction } from "@/actions/social";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_WEEK_SOCIAL_CAPTION,
  defaultSelectedAccountIds,
  type SocialAccount,
} from "@/lib/ghl/social";
import {
  WEEK_SOCIAL_FORMATS,
  weekSocialExportPath,
  type WeekSocialFormatId,
} from "@/lib/screens/social";
import { joinPublicUrl } from "@/lib/public/urls";
import { cn } from "@/lib/utils";

export function SocialComposeForm({
  accounts,
  formatId: initialFormatId,
  pageCountByFormat,
  publicOrigin,
}: {
  accounts: SocialAccount[];
  formatId: WeekSocialFormatId;
  pageCountByFormat: Record<WeekSocialFormatId, number>;
  publicOrigin: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaults = useMemo(() => defaultSelectedAccountIds(accounts), [accounts]);
  const [selected, setSelected] = useState<string[]>(defaults);
  const [summary, setSummary] = useState(DEFAULT_WEEK_SOCIAL_CAPTION);
  const [formatId, setFormatId] = useState<WeekSocialFormatId>(initialFormatId);
  const [status, setStatus] = useState<"draft" | "scheduled">("draft");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const pageCount = Math.max(1, pageCountByFormat[formatId] ?? 1);

  const mediaPreviewUrls = useMemo(
    () =>
      Array.from({ length: pageCount }, (_, index) =>
        joinPublicUrl(publicOrigin, weekSocialExportPath({ formatId, page: index + 1 })),
      ),
    [formatId, pageCount, publicOrigin],
  );

  function toggleAccount(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function submit() {
    startTransition(async () => {
      const scheduleDate =
        status === "scheduled" && scheduleLocal
          ? new Date(scheduleLocal).toISOString()
          : null;
      const result = await createWeekSocialPostAction({
        accountIds: selected,
        summary,
        status,
        scheduleDate,
        formatId,
        pageCount,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.id) router.push(`/social/posts/${result.id}`);
      else router.push("/social");
      router.refresh();
    });
  }

  const previewHref = weekSocialExportPath({ formatId, page: 1 });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="social-summary">Caption</Label>
          <Textarea id="social-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} />
        </div>

        <div className="space-y-2">
          <Label>Graphic size</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEEK_SOCIAL_FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                onClick={() => setFormatId(format.id)}
                className={
                  format.id === formatId
                    ? "rounded-lg border border-primary bg-primary/5 px-3 py-2 text-left text-sm"
                    : "rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/50"
                }
              >
                <span className="block font-medium">{format.label}</span>
                <span className="text-muted-foreground">{format.hint}</span>
              </button>
            ))}
          </div>
          {pageCount > 1 ? (
            <p className="text-xs text-muted-foreground">
              Busy week: all {pageCount} graphic pages will attach as media.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Accounts</Label>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connected accounts labeled Flobama Downtown in GoHighLevel.
            </p>
          ) : (
            <ul className="space-y-2 rounded-xl border bg-card p-3">
              {accounts.map((account) => {
                const checked = selected.includes(account.id);
                return (
                  <li key={account.id}>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={account.isExpired}
                        onChange={() => toggleAccount(account.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{account.name}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          <Badge variant="secondary">{account.platform}</Badge>
                          {account.isExpired ? <Badge variant="destructive">Expired</Badge> : null}
                          {!account.imageCapable ? <Badge variant="outline">Manual pick</Badge> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="social-status">Status</Label>
            <select
              id="social-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "draft" | "scheduled")}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social-schedule">Schedule (local)</Label>
            <Input
              id="social-schedule"
              type="datetime-local"
              value={scheduleLocal}
              disabled={status !== "scheduled"}
              onChange={(event) => setScheduleLocal(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={submit}>
            {status === "draft" ? "Save draft in GHL" : "Schedule in GHL"}
          </Button>
          <a
            className={cn(buttonVariants({ variant: "outline" }))}
            href={previewHref}
            target="_blank"
            rel="noreferrer"
          >
            Open PNG
          </a>
        </div>
      </div>

      <aside className="space-y-3">
        <h2 className="text-sm font-medium">Media preview URLs</h2>
        <ul className="space-y-2 text-xs break-all text-muted-foreground">
          {mediaPreviewUrls.map((url) => (
            <li key={url} className="rounded-lg border bg-card p-2 font-mono">
              <a href={url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {url}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          GoHighLevel fetches these public HTTPS PNGs when publishing. Default caption and draft status keep posts
          reviewable before they go live.
        </p>
      </aside>
    </div>
  );
}
