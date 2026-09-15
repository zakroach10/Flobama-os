import Link from "next/link";
import { notFound } from "next/navigation";
import { isGhlConfigured } from "@/lib/env";
import {
  getSocialPost,
  getSocialStatistics,
  listSocialAccounts,
  listSocialComments,
} from "@/lib/ghl/social";
import { EmptyState, ErrorState } from "@/components/states";
import { SocialPostDetail } from "@/components/social/social-post-detail";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SocialPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id?.trim()) notFound();

  if (!isGhlConfigured()) {
    return (
      <EmptyState
        title="GoHighLevel is not connected"
        description="Set GHL_PRIVATE_TOKEN and GHL_LOCATION_ID to manage Social Planner posts."
        actionHref="/settings"
        actionLabel="Open settings"
      />
    );
  }

  let post = null as Awaited<ReturnType<typeof getSocialPost>>;
  let loadError: string | undefined;
  try {
    post = await getSocialPost(id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load post.";
  }

  if (loadError) {
    return <ErrorState title="Could not load post" description={loadError} />;
  }
  if (!post) notFound();

  const accounts = await listSocialAccounts().catch(() => []);
  const matched = accounts.filter((account) => post!.accountIds.includes(account.id));
  const profileIds = matched.map((account) => account.profileId).filter((value): value is string => Boolean(value));
  const platforms = [...new Set(matched.map((account) => account.platform).filter(Boolean))];

  const statistics =
    profileIds.length > 0
      ? await getSocialStatistics({ profileIds, platforms })
      : null;

  const primaryPlatform = platforms[0];
  const comments =
    primaryPlatform && profileIds.length > 0
      ? await listSocialComments({
          platform: primaryPlatform,
          originIds: profileIds,
          parentId: post.id,
        })
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Post detail</h2>
        <Link href="/social" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to Social
        </Link>
      </div>
      <SocialPostDetail post={post} accounts={accounts} statistics={statistics} comments={comments} />
    </div>
  );
}
