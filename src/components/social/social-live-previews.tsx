"use client";

import { accountsForLivePreview, type SocialAccount } from "@/lib/ghl/social";
import type { WeekSocialFormatId } from "@/lib/screens/social";
import { FacebookPreview } from "@/components/social/previews/facebook-preview";
import { InstagramPreview } from "@/components/social/previews/instagram-preview";
import { GooglePreview } from "@/components/social/previews/google-preview";

export function SocialLivePreviews({
  accounts,
  selectedIds,
  summary,
  mediaPreviewUrls,
  formatId,
}: {
  accounts: SocialAccount[];
  selectedIds: string[];
  summary: string;
  mediaPreviewUrls: string[];
  formatId: WeekSocialFormatId;
}) {
  const previewAccounts = accountsForLivePreview(selectedIds, accounts);
  const mediaUrl = mediaPreviewUrls[0] ?? "";
  const pageCount = Math.max(1, mediaPreviewUrls.length);

  if (previewAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        Select a Facebook, Instagram, or Google account to preview.
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        Graphic preview URL is not ready yet.
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(70vh,52rem)] flex-col gap-6 overflow-y-auto py-1">
      {previewAccounts.map((account) => {
        const platform = account.platform.trim().toLowerCase();
        if (platform === "facebook") {
          return (
            <FacebookPreview
              key={account.id}
              account={account}
              summary={summary}
              mediaUrl={mediaUrl}
              pageCount={pageCount}
            />
          );
        }
        if (platform === "instagram") {
          return (
            <InstagramPreview
              key={account.id}
              account={account}
              summary={summary}
              mediaUrl={mediaUrl}
              pageCount={pageCount}
              formatId={formatId}
            />
          );
        }
        if (platform === "google") {
          return (
            <GooglePreview
              key={account.id}
              account={account}
              summary={summary}
              mediaUrl={mediaUrl}
              pageCount={pageCount}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
