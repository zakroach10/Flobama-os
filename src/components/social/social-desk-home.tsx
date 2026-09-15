import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/states";
import type { SocialAccount, SocialPost } from "@/lib/ghl/social";
import { cn } from "@/lib/utils";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function SocialDeskHome({
  configured,
  accounts,
  posts,
  error,
}: {
  configured: boolean;
  accounts: SocialAccount[];
  posts: SocialPost[];
  error?: string;
}) {
  if (!configured) {
    return (
      <EmptyState
        title="GoHighLevel is not connected"
        description="Set GHL_PRIVATE_TOKEN and GHL_LOCATION_ID on the server, and grant Social Planner scopes on the Private Integration Token."
        actionHref="/settings"
        actionLabel="Open settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorState title="Could not load Social Planner" description={error} /> : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Connected accounts</h2>
            <p className="text-sm text-muted-foreground">
              Only <strong>Flobama Downtown</strong>, <strong>Flobama Instagram</strong>, and{" "}
              <strong>Flobama Google</strong> accounts are listed (Instagram/Google platforms also match when the name
              includes FloBama). Image-capable ones are pre-selected when composing.
            </p>
          </div>
          <Link href="/social/compose" className={cn(buttonVariants({ variant: "default" }))}>
            Compose week graphic
          </Link>
        </div>
        {accounts.length === 0 ? (
          <EmptyState
            title="No FloBama social accounts"
            description="Connect channels in GoHighLevel Social Planner labeled Flobama Downtown, Flobama Instagram, or Flobama Google, then refresh this page."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => (
              <li key={account.id} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{account.name}</span>
                  <Badge variant="secondary">{account.platform}</Badge>
                  {account.isExpired ? <Badge variant="destructive">Expired</Badge> : null}
                  {!account.imageCapable ? <Badge variant="outline">Not image default</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent posts</h2>
        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Draft or schedule this week’s event graphic from Compose."
            actionHref="/social/compose"
            actionLabel="Compose week graphic"
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {posts.map((post) => (
              <li key={post.id}>
                <Link href={`/social/posts/${post.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{post.summary || "(No caption)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {post.accountIds.length} account{post.accountIds.length === 1 ? "" : "s"} · updated{" "}
                      {formatWhen(post.updatedAt ?? post.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="w-fit capitalize">
                    {post.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
