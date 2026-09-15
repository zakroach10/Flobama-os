"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSocialPostAction, updateSocialPostAction } from "@/actions/social";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SocialAccount, SocialPost } from "@/lib/ghl/social";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SocialPostDetail({
  post,
  accounts,
  statistics,
  comments,
}: {
  post: SocialPost;
  accounts: SocialAccount[];
  statistics: unknown | null;
  comments: unknown | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState(post.summary);

  const accountNames = post.accountIds
    .map((id) => accounts.find((account) => account.id === id)?.name ?? id)
    .join(", ");

  function saveSummary() {
    startTransition(async () => {
      const result = await updateSocialPostAction(post.id, { summary });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this post in GoHighLevel?")) return;
    startTransition(async () => {
      const result = await deleteSocialPostAction(post.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.push("/social");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {post.status}
        </Badge>
        <Badge variant="outline">{post.type}</Badge>
        <span className="text-sm text-muted-foreground">Updated {formatWhen(post.updatedAt ?? post.createdAt)}</span>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="post-summary">Caption</Label>
          <Textarea id="post-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending || summary === post.summary} onClick={saveSummary}>
            Save caption
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
            Delete in GHL
          </Button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">Targets</h2>
        <p className="text-muted-foreground">{accountNames || "No accounts"}</p>
        {post.scheduleDate ? (
          <p>
            Scheduled: <span className="font-medium">{formatWhen(post.scheduleDate)}</span>
          </p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Media</h2>
        <ul className="space-y-2 text-xs break-all">
          {post.media.length === 0 ? (
            <li className="text-muted-foreground">No media attached.</li>
          ) : (
            post.media.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                  {item.url}
                </a>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Analytics</h2>
        {statistics ? (
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">{JSON.stringify(statistics, null, 2)}</pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Statistics unavailable (missing scope, no profile ids, or API error). Posting still works without this.
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Comments</h2>
        {comments ? (
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">{JSON.stringify(comments, null, 2)}</pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Comments unavailable for this post or platform. The desk degrades gracefully when the Comments API is not
            reachable.
          </p>
        )}
      </section>
    </div>
  );
}
