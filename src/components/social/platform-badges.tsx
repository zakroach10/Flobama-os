import { Badge } from "@/components/ui/badge";
import type { SocialAccount } from "@/lib/ghl/social";
import { formatSocialPlatform, resolvePostPlatforms } from "@/lib/ghl/social";
import { cn } from "@/lib/utils";

const PLATFORM_TONE: Record<string, string> = {
  facebook: "border-transparent bg-[#1877F2]/15 text-[#0b4fad]",
  instagram: "border-transparent bg-[#E1306C]/14 text-[#a31d4a]",
  google: "border-transparent bg-[#4285F4]/14 text-[#1a56b0]",
  linkedin: "border-transparent bg-[#0A66C2]/14 text-[#064a8c]",
  threads: "border-transparent bg-foreground/10 text-foreground",
  youtube: "border-transparent bg-[#FF0000]/12 text-[#b00000]",
  tiktok: "border-transparent bg-foreground/10 text-foreground",
  twitter: "border-transparent bg-[#1D9BF0]/14 text-[#0b6eae]",
  x: "border-transparent bg-foreground/10 text-foreground",
  pinterest: "border-transparent bg-[#E60023]/12 text-[#a10018]",
  bluesky: "border-transparent bg-[#0085FF]/14 text-[#0066c2]",
};

export function PlatformBadges({
  accountIds,
  accounts,
  className,
}: {
  accountIds: string[];
  accounts: SocialAccount[];
  className?: string;
}) {
  const platforms = resolvePostPlatforms(accountIds, accounts);
  if (platforms.length === 0) {
    return (
      <Badge variant="outline" className={cn("capitalize", className)}>
        No platforms
      </Badge>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {platforms.map((platform) => (
        <Badge
          key={platform}
          variant="outline"
          className={cn("capitalize", PLATFORM_TONE[platform] ?? undefined)}
        >
          {formatSocialPlatform(platform)}
        </Badge>
      ))}
    </div>
  );
}
