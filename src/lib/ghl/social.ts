import { getPublicAppUrl } from "@/lib/env";
import {
  ghlConfigured,
  ghlFetch,
  resolveGhlConfig,
  type GhlDeps,
} from "@/lib/ghl/client";
import {
  DEFAULT_WEEK_SOCIAL_FORMAT,
  isWeekSocialFormatId,
  weekSocialExportPath,
  weekSocialFormat,
  weekSocialPages,
  type WeekSocialFormatId,
} from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";
import { joinPublicUrl } from "@/lib/public/urls";

/** Human-readable PIT scopes for Settings (API keys differ slightly in the Private Integration UI). */
export const SOCIAL_PIT_SCOPES = [
  "Social Planner accounts: read",
  "Social Planner posts: read",
  "Social Planner posts: write",
  "Social Planner statistics: read",
] as const;

/** Platforms that accept a static image post for weekly graphics. */
const IMAGE_CAPABLE_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "linkedin",
  "google",
  "pinterest",
  "threads",
  "bluesky",
  "community",
]);

export const DEFAULT_WEEK_SOCIAL_CAPTION = "Live music this week at FloBama.";

/** Offer GHL Social Planner accounts labeled Flobama Downtown, Instagram, or Google. */
export const SOCIAL_ACCOUNT_NAME_ALLOWLIST = new Set([
  "flobama downtown",
  "flobama instagram",
  "flobama google",
]);

/** @deprecated Use SOCIAL_ACCOUNT_NAME_ALLOWLIST */
export const SOCIAL_ACCOUNT_NAME_FILTER = "flobama downtown";

/** Platforms that may match by “Flobama …” name even when the exact label differs. */
const SOCIAL_ACCOUNT_PLATFORM_ALLOWLIST = new Set(["instagram", "google"]);

export type SocialPostStatus = "draft" | "scheduled" | "published" | "failed" | "in_review" | "in_progress" | "pending" | "deleted" | string;

export type SocialPostType = "post" | "story" | "reel";

export type SocialMediaItem = {
  url: string;
  type: string;
  caption?: string;
  altText?: string;
};

export type SocialAccount = {
  id: string;
  name: string;
  platform: string;
  type: string | null;
  profileId: string | null;
  isExpired: boolean;
  imageCapable: boolean;
};

export type SocialPost = {
  id: string;
  summary: string;
  status: SocialPostStatus;
  type: SocialPostType | string;
  accountIds: string[];
  media: SocialMediaItem[];
  scheduleDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown>;
};

export type CreateSocialPostInput = {
  accountIds: string[];
  summary: string;
  status: "draft" | "scheduled" | "published";
  scheduleDate?: string | null;
  media: SocialMediaItem[];
  type?: SocialPostType;
  userId?: string;
};

export type ListSocialPostsInput = {
  accountIds: string[];
  type?: "all" | "recent" | "scheduled" | "draft" | "failed" | "published" | "in_review" | "in_progress" | "pending" | "deleted";
  postType?: SocialPostType | "all";
  skip?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
}

function resultsObject(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  return asRecord(root.results) ?? root;
}

export function isImageCapablePlatform(platform: string | null | undefined): boolean {
  if (!platform) return true;
  return IMAGE_CAPABLE_PLATFORMS.has(platform.trim().toLowerCase());
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  threads: "Threads",
  twitter: "X",
  x: "X",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  community: "Community",
};

export function formatSocialPlatform(platform: string | null | undefined): string {
  const key = (platform ?? "").trim().toLowerCase();
  if (!key) return "Unknown";
  return PLATFORM_LABELS[key] ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Unique platforms for a post, ordered by account list / first appearance. */
export function resolvePostPlatforms(
  accountIds: string[],
  accounts: Pick<SocialAccount, "id" | "platform">[],
): string[] {
  const byId = new Map(accounts.map((account) => [account.id, account.platform]));
  const seen = new Set<string>();
  const platforms: string[] = [];
  for (const id of accountIds) {
    const platform = (byId.get(id) ?? "").trim().toLowerCase();
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    platforms.push(platform);
  }
  return platforms;
}

export function normalizeSocialAccountLabel(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match Flobama Downtown / Instagram / Google Social Planner accounts. */
export function isAllowedSocialAccount(
  account: Pick<SocialAccount, "name" | "platform"> | string | null | undefined,
): boolean {
  if (account == null) return false;
  if (typeof account === "string") {
    return SOCIAL_ACCOUNT_NAME_ALLOWLIST.has(normalizeSocialAccountLabel(account));
  }
  const name = normalizeSocialAccountLabel(account.name);
  if (SOCIAL_ACCOUNT_NAME_ALLOWLIST.has(name)) return true;
  const platform = normalizeSocialAccountLabel(account.platform);
  if (SOCIAL_ACCOUNT_PLATFORM_ALLOWLIST.has(platform) && name.includes("flobama")) return true;
  return false;
}

/** @deprecated Use isAllowedSocialAccount */
export function isFlobamaDowntownAccount(
  account: Pick<SocialAccount, "name" | "platform"> | string | null | undefined,
): boolean {
  return isAllowedSocialAccount(account);
}

export function filterAllowedSocialAccounts(accounts: SocialAccount[]): SocialAccount[] {
  return accounts.filter(isAllowedSocialAccount);
}

/** @deprecated Use filterAllowedSocialAccounts */
export function filterFlobamaDowntownAccounts(accounts: SocialAccount[]): SocialAccount[] {
  return filterAllowedSocialAccounts(accounts);
}

export function mapSocialAccount(raw: unknown): SocialAccount | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  if (!id) return null;
  const platform = asString(record.platform) ?? "unknown";
  return {
    id,
    name: asString(record.name) ?? platform,
    platform,
    type: asString(record.type),
    profileId: asString(record.profileId),
    isExpired: Boolean(record.isExpired),
    imageCapable: isImageCapablePlatform(platform),
  };
}

export function extractSocialAccounts(payload: unknown): SocialAccount[] {
  const results = resultsObject(payload);
  const list = results?.accounts ?? asRecord(payload)?.accounts;
  if (!Array.isArray(list)) return [];
  return list.map(mapSocialAccount).filter((account): account is SocialAccount => Boolean(account));
}

export function mapSocialMediaItem(raw: unknown): SocialMediaItem | null {
  const record = asRecord(raw);
  if (!record) return null;
  const url = asString(record.url);
  if (!url) return null;
  return {
    url,
    type: asString(record.type) ?? "image/png",
    caption: asString(record.caption) ?? undefined,
    altText: asString(record.altText) ?? undefined,
  };
}

export function mapSocialPost(raw: unknown): SocialPost | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record._id) ?? asString(record.id);
  if (!id) return null;
  const mediaRaw = record.media;
  const media = Array.isArray(mediaRaw)
    ? mediaRaw.map(mapSocialMediaItem).filter((item): item is SocialMediaItem => Boolean(item))
    : [];
  return {
    id,
    summary: asString(record.summary) ?? "",
    status: asString(record.status) ?? "draft",
    type: asString(record.type) ?? "post",
    accountIds: asStringArray(record.accountIds),
    media,
    scheduleDate: asString(record.scheduleDate),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
    raw: record,
  };
}

export function extractSocialPosts(payload: unknown): SocialPost[] {
  const results = resultsObject(payload);
  const list = results?.posts ?? asRecord(payload)?.posts;
  if (!Array.isArray(list)) {
    const single = mapSocialPost(results?.post ?? asRecord(payload)?.post);
    return single ? [single] : [];
  }
  return list.map(mapSocialPost).filter((post): post is SocialPost => Boolean(post));
}

export function extractSocialPost(payload: unknown): SocialPost | null {
  const results = resultsObject(payload);
  return mapSocialPost(results?.post ?? asRecord(payload)?.post ?? payload);
}

export function buildCreateSocialPostBody(input: CreateSocialPostInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    accountIds: input.accountIds,
    type: input.type ?? "post",
    summary: input.summary,
    status: input.status,
    media: input.media.map((item) => ({
      url: item.url,
      type: item.type,
      ...(item.caption ? { caption: item.caption } : {}),
      ...(item.altText ? { altText: item.altText } : {}),
    })),
  };
  if (input.userId) body.userId = input.userId;
  if (input.status === "scheduled" && input.scheduleDate) {
    body.scheduleDate = input.scheduleDate;
  }
  return body;
}

export function buildListSocialPostsBody(input: ListSocialPostsInput): Record<string, unknown> {
  return {
    type: input.type ?? "all",
    accounts: input.accountIds.join(","),
    skip: String(input.skip ?? 0),
    limit: String(input.limit ?? 20),
    includeUsers: "true",
    ...(input.postType && input.postType !== "all" ? { postType: input.postType } : {}),
    ...(input.fromDate ? { fromDate: input.fromDate } : {}),
    ...(input.toDate ? { toDate: input.toDate } : {}),
  };
}

export function weekSocialMediaUrls(options: {
  formatId?: WeekSocialFormatId | string | null;
  pageCount?: number;
  origin?: string;
}): string[] {
  const formatId = isWeekSocialFormatId(options.formatId) ? options.formatId : DEFAULT_WEEK_SOCIAL_FORMAT;
  const origin = options.origin ?? getPublicAppUrl();
  const pages = Math.max(1, options.pageCount ?? 1);
  return Array.from({ length: pages }, (_, index) => {
    const path = weekSocialExportPath({ formatId, page: index + 1 });
    return joinPublicUrl(origin, path);
  });
}

export function weekSocialMediaItems(options: {
  formatId?: WeekSocialFormatId | string | null;
  pageCount?: number;
  origin?: string;
  altText?: string;
}): SocialMediaItem[] {
  return weekSocialMediaUrls(options).map((url) => ({
    url,
    type: "image/png",
    altText: options.altText ?? "Live music this week at FloBama",
  }));
}

export function weekSocialPageCount(days: WeekSlideDay[], formatId?: WeekSocialFormatId | string | null) {
  const id = isWeekSocialFormatId(formatId) ? formatId : DEFAULT_WEEK_SOCIAL_FORMAT;
  return Math.max(1, weekSocialPages(days, weekSocialFormat(id)).length);
}

export function defaultSelectedAccountIds(accounts: SocialAccount[]): string[] {
  return accounts.filter((account) => account.imageCapable && !account.isExpired).map((account) => account.id);
}

export async function listSocialAccounts(deps?: GhlDeps): Promise<SocialAccount[]> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return [];
  const payload = await ghlFetch(
    `/social-media-posting/${encodeURIComponent(config.locationId)}/accounts`,
    {},
    { ...deps, config },
  );
  return filterAllowedSocialAccounts(extractSocialAccounts(payload));
}

export function extractLocationUserIds(payload: unknown): string[] {
  const root = asRecord(payload);
  const list = root?.users;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const record = asRecord(item);
      if (!record || record.deleted === true) return null;
      return asString(record.id);
    })
    .filter((id): id is string => Boolean(id));
}

/** GHL requires userId for non-draft Social Planner posts to connected OAuth channels. */
export async function resolveSocialUserId(deps?: GhlDeps): Promise<string | null> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return null;
  if (config.socialUserId) return config.socialUserId;
  try {
    const payload = await ghlFetch(
      "/users/",
      { searchParams: { locationId: config.locationId } },
      { ...deps, config },
    );
    return extractLocationUserIds(payload)[0] ?? null;
  } catch {
    return null;
  }
}

export async function listSocialPosts(input: ListSocialPostsInput, deps?: GhlDeps): Promise<SocialPost[]> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return [];
  if (input.accountIds.length === 0) return [];
  const payload = await ghlFetch(
    `/social-media-posting/${encodeURIComponent(config.locationId)}/posts/list`,
    { method: "POST", body: buildListSocialPostsBody(input) },
    { ...deps, config },
  );
  return extractSocialPosts(payload);
}

export async function getSocialPost(postId: string, deps?: GhlDeps): Promise<SocialPost | null> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config) || !postId.trim()) return null;
  const payload = await ghlFetch(
    `/social-media-posting/${encodeURIComponent(config.locationId)}/posts/${encodeURIComponent(postId)}`,
    {},
    { ...deps, config },
  );
  return extractSocialPost(payload);
}

export async function createSocialPost(input: CreateSocialPostInput, deps?: GhlDeps): Promise<SocialPost> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) {
    throw new Error("GoHighLevel is not configured.");
  }
  if (input.status === "scheduled" && !input.scheduleDate) {
    throw new Error("Schedule date is required for scheduled posts.");
  }
  if (input.status !== "draft" && input.accountIds.length === 0) {
    throw new Error("Select at least one social account.");
  }

  let userId = input.userId?.trim() || undefined;
  if (input.status !== "draft" && !userId) {
    userId = (await resolveSocialUserId({ ...deps, config })) ?? undefined;
    if (!userId) {
      throw new Error(
        "GoHighLevel userId is required to post. Set GHL_SOCIAL_USER_ID, or grant users.readonly on the Private Integration Token.",
      );
    }
  }

  const payload = await ghlFetch(
    `/social-media-posting/${encodeURIComponent(config.locationId)}/posts`,
    { method: "POST", body: buildCreateSocialPostBody({ ...input, userId }) },
    { ...deps, config },
  );
  const post = extractSocialPost(payload);
  if (!post) throw new Error("GoHighLevel did not return a post.");
  return post;
}

export async function updateSocialPost(
  postId: string,
  input: Partial<CreateSocialPostInput> & { summary?: string },
  deps?: GhlDeps,
): Promise<SocialPost> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config) || !postId.trim()) {
    throw new Error("GoHighLevel is not configured.");
  }
  const body: Record<string, unknown> = {};
  if (input.accountIds) body.accountIds = input.accountIds;
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.status) body.status = input.status;
  if (input.scheduleDate !== undefined) body.scheduleDate = input.scheduleDate;
  if (input.media) {
    body.media = input.media.map((item) => ({
      url: item.url,
      type: item.type,
      ...(item.caption ? { caption: item.caption } : {}),
      ...(item.altText ? { altText: item.altText } : {}),
    }));
  }
  if (input.type) body.type = input.type;
  if (input.userId) body.userId = input.userId;

  const payload = await ghlFetch(
    `/social-media-posting/${encodeURIComponent(config.locationId)}/posts/${encodeURIComponent(postId)}`,
    { method: "PUT", body },
    { ...deps, config },
  );
  const post = extractSocialPost(payload);
  if (!post) throw new Error("GoHighLevel did not return a post.");
  return post;
}

export async function deleteSocialPost(postId: string, deps?: GhlDeps): Promise<void> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config) || !postId.trim()) {
    throw new Error("GoHighLevel is not configured.");
  }
  await ghlFetch(
    `/social-media-posting/${encodeURIComponent(config.locationId)}/posts/${encodeURIComponent(postId)}`,
    { method: "DELETE" },
    { ...deps, config },
  );
}

export type SocialStatisticsInput = {
  profileIds: string[];
  platforms?: string[];
  currentRange?: { startDate: string; endDate: string };
  prevRange?: { startDate: string; endDate: string };
};

export async function getSocialStatistics(input: SocialStatisticsInput, deps?: GhlDeps): Promise<unknown | null> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config) || input.profileIds.length === 0) return null;
  try {
    return await ghlFetch(
      "/social-media-posting/statistics",
      {
        method: "POST",
        searchParams: { locationId: config.locationId },
        body: {
          profileIds: input.profileIds,
          ...(input.platforms?.length ? { platforms: input.platforms } : {}),
          ...(input.currentRange ? { currentRange: input.currentRange } : {}),
          ...(input.prevRange ? { prevRange: input.prevRange } : {}),
        },
      },
      { ...deps, config },
    );
  } catch {
    return null;
  }
}

export type ListSocialCommentsInput = {
  platform: string;
  originIds: string[];
  parentId?: string;
  skip?: number;
  limit?: number;
};

export async function listSocialComments(input: ListSocialCommentsInput, deps?: GhlDeps): Promise<unknown | null> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config) || !input.platform.trim()) return null;
  try {
    return await ghlFetch(
      `/social-media-posting/comments/${encodeURIComponent(input.platform)}/list`,
      {
        method: "POST",
        searchParams: { locationId: config.locationId },
        body: {
          originIds: input.originIds,
          ...(input.parentId ? { parentId: input.parentId } : {}),
          sortBy: "latest",
          skip: input.skip ?? 0,
          limit: input.limit ?? 10,
        },
      },
      { ...deps, config },
    );
  } catch {
    return null;
  }
}

export type SocialDeskHome =
  | { configured: false }
  | {
      configured: true;
      accounts: SocialAccount[];
      posts: SocialPost[];
      error?: string;
    };

export async function loadSocialDeskHome(deps?: GhlDeps): Promise<SocialDeskHome> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return { configured: false };

  try {
    const accounts = await listSocialAccounts({ ...deps, config });
    const posts =
      accounts.length === 0
        ? []
        : await listSocialPosts(
            { accountIds: accounts.map((account) => account.id), type: "all", limit: 25 },
            { ...deps, config },
          );
    return { configured: true, accounts, posts };
  } catch (error) {
    return {
      configured: true,
      accounts: [],
      posts: [],
      error: error instanceof Error ? error.message : "Could not load Social Planner data.",
    };
  }
}
