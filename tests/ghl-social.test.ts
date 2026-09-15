import { describe, expect, it } from "vitest";
import { type GhlDeps } from "@/lib/ghl/client";
import {
  buildCreateSocialPostBody,
  buildListSocialPostsBody,
  createSocialPost,
  defaultSelectedAccountIds,
  extractSocialAccounts,
  extractSocialPost,
  extractSocialPosts,
  extractLocationUserIds,
  filterAllowedSocialAccounts,
  isAllowedSocialAccount,
  isImageCapablePlatform,
  listSocialAccounts,
  resolveSocialUserId,
  weekSocialMediaItems,
  weekSocialMediaUrls,
  type SocialAccount,
} from "@/lib/ghl/social";
import { PRODUCTION_SITE_URL } from "@/lib/public/urls";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function configuredDeps(fetchImpl: typeof fetch): GhlDeps {
  return {
    config: {
      token: "pit_test",
      locationId: "loc_1",
      apiVersion: "2021-07-28",
      objectKeys: {},
    },
    fetchImpl,
  };
}

describe("week social media URLs", () => {
  it("builds absolute HTTPS PNG URLs for each page", () => {
    const urls = weekSocialMediaUrls({
      formatId: "ig-square",
      pageCount: 2,
      origin: PRODUCTION_SITE_URL,
    });
    expect(urls).toEqual([
      "https://flobama-os.vercel.app/api/public/v1/screens/week/social?size=ig-square",
      "https://flobama-os.vercel.app/api/public/v1/screens/week/social?size=ig-square&page=2",
    ]);
  });

  it("maps media items as image/png", () => {
    const media = weekSocialMediaItems({ formatId: "story", pageCount: 1, origin: PRODUCTION_SITE_URL });
    expect(media).toEqual([
      {
        url: "https://flobama-os.vercel.app/api/public/v1/screens/week/social?size=story",
        type: "image/png",
        altText: "Live music this week at FloBama",
      },
    ]);
  });
});

describe("create-post payload", () => {
  it("uses summary, accountIds, and media objects for drafts", () => {
    const body = buildCreateSocialPostBody({
      accountIds: ["acc_1"],
      summary: "Live music this week at FloBama.",
      status: "draft",
      media: [{ url: "https://example.com/a.png", type: "image/png" }],
    });
    expect(body).toEqual({
      accountIds: ["acc_1"],
      type: "post",
      summary: "Live music this week at FloBama.",
      status: "draft",
      media: [{ url: "https://example.com/a.png", type: "image/png" }],
    });
    expect(body).not.toHaveProperty("scheduleDate");
  });

  it("includes scheduleDate when status is scheduled", () => {
    const body = buildCreateSocialPostBody({
      accountIds: ["acc_1"],
      summary: "Show night",
      status: "scheduled",
      scheduleDate: "2026-09-16T17:00:00.000Z",
      media: [{ url: "https://example.com/a.png", type: "image/png", altText: "Lineup" }],
      type: "story",
    });
    expect(body.status).toBe("scheduled");
    expect(body.scheduleDate).toBe("2026-09-16T17:00:00.000Z");
    expect(body.type).toBe("story");
    expect(body.media).toEqual([
      { url: "https://example.com/a.png", type: "image/png", altText: "Lineup" },
    ]);
  });

  it("publishes now without scheduleDate", () => {
    const body = buildCreateSocialPostBody({
      accountIds: ["acc_1"],
      summary: "Live music this week at FloBama.",
      status: "published",
      userId: "user_1",
      media: [{ url: "https://example.com/a.png", type: "image/png" }],
    });
    expect(body.status).toBe("published");
    expect(body.userId).toBe("user_1");
    expect(body).not.toHaveProperty("scheduleDate");
  });

  it("lists posts with comma-separated accounts string", () => {
    expect(
      buildListSocialPostsBody({
        accountIds: ["a", "b"],
        type: "draft",
        limit: 5,
      }),
    ).toEqual({
      type: "draft",
      accounts: "a,b",
      skip: "0",
      limit: "5",
      includeUsers: "true",
    });
  });
});

describe("account mapping", () => {
  it("marks youtube as not image-capable by default", () => {
    expect(isImageCapablePlatform("instagram")).toBe(true);
    expect(isImageCapablePlatform("youtube")).toBe(false);
    const accounts: SocialAccount[] = [
      {
        id: "ig",
        name: "Flobama Downtown",
        platform: "instagram",
        type: null,
        profileId: "p1",
        isExpired: false,
        imageCapable: true,
      },
      {
        id: "yt",
        name: "Flobama Downtown",
        platform: "youtube",
        type: null,
        profileId: "p2",
        isExpired: false,
        imageCapable: false,
      },
      {
        id: "expired",
        name: "Flobama Downtown",
        platform: "facebook",
        type: null,
        profileId: "p3",
        isExpired: true,
        imageCapable: true,
      },
    ];
    expect(defaultSelectedAccountIds(accounts)).toEqual(["ig"]);
  });

  it("matches Flobama Downtown, Instagram, and Google accounts", () => {
    expect(isAllowedSocialAccount("Flobama Downtown")).toBe(true);
    expect(isAllowedSocialAccount("  flobama   downtown ")).toBe(true);
    expect(isAllowedSocialAccount("Flobama Instagram")).toBe(true);
    expect(isAllowedSocialAccount("Flobama Google")).toBe(true);
    expect(isAllowedSocialAccount("FloBama Uptown")).toBe(false);
    expect(
      isAllowedSocialAccount({
        name: "FloBama Music Hall",
        platform: "instagram",
      }),
    ).toBe(true);
    expect(
      isAllowedSocialAccount({
        name: "FloBama Music Hall",
        platform: "google",
      }),
    ).toBe(true);
    expect(
      isAllowedSocialAccount({
        name: "Other Page",
        platform: "instagram",
      }),
    ).toBe(false);
    expect(
      filterAllowedSocialAccounts([
        {
          id: "keep-downtown",
          name: "Flobama Downtown",
          platform: "facebook",
          type: null,
          profileId: "p1",
          isExpired: false,
          imageCapable: true,
        },
        {
          id: "keep-ig",
          name: "Flobama Instagram",
          platform: "instagram",
          type: null,
          profileId: "p2",
          isExpired: false,
          imageCapable: true,
        },
        {
          id: "keep-google",
          name: "Flobama Google",
          platform: "google",
          type: null,
          profileId: "p3",
          isExpired: false,
          imageCapable: true,
        },
        {
          id: "drop",
          name: "Other Page",
          platform: "instagram",
          type: null,
          profileId: "p4",
          isExpired: false,
          imageCapable: true,
        },
      ]).map((account) => account.id),
    ).toEqual(["keep-downtown", "keep-ig", "keep-google"]);
  });

  it("extracts accounts from GHL payload", () => {
    const accounts = extractSocialAccounts({
      results: {
        accounts: [
          { id: "acc_1", name: "FloBama", platform: "facebook", profileId: "prof_1", isExpired: false },
          { id: "acc_2", name: "Reels", platform: "youtube", isExpired: false },
        ],
      },
    });
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({ id: "acc_1", imageCapable: true });
    expect(accounts[1].imageCapable).toBe(false);
  });
});

describe("social ghlFetch wrappers", () => {
  it("lists Flobama Downtown, Instagram, and Google accounts", async () => {
    const calls: { url: string; method?: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return jsonResponse({
        results: {
          accounts: [
            { id: "acc_downtown", name: "Flobama Downtown", platform: "facebook", profileId: "p1" },
            { id: "acc_ig", name: "Flobama Instagram", platform: "instagram", profileId: "p2" },
            { id: "acc_google", name: "Flobama Google", platform: "google", profileId: "p3" },
            { id: "acc_drop", name: "Other Venue", platform: "instagram", profileId: "p4" },
          ],
        },
      });
    };
    const accounts = await listSocialAccounts(configuredDeps(fetchImpl));
    expect(accounts.map((account) => account.id)).toEqual(["acc_downtown", "acc_ig", "acc_google"]);
    expect(calls[0]?.url).toContain("/social-media-posting/loc_1/accounts");
  });

  it("creates a draft post and unwraps results.post", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.summary).toBe("Live music this week at FloBama.");
      expect(body.status).toBe("draft");
      expect(body.media[0].type).toBe("image/png");
      return jsonResponse(
        {
          success: true,
          results: {
            post: {
              _id: "post_1",
              summary: body.summary,
              status: "draft",
              accountIds: body.accountIds,
              media: body.media,
              type: "post",
              createdAt: "2026-09-15T00:00:00.000Z",
            },
          },
        },
        201,
      );
    };

    const post = await createSocialPost(
      {
        accountIds: ["acc_1"],
        summary: "Live music this week at FloBama.",
        status: "draft",
        media: weekSocialMediaItems({ formatId: "ig-square", origin: PRODUCTION_SITE_URL }),
      },
      configuredDeps(fetchImpl),
    );
    expect(post.id).toBe("post_1");
    expect(extractSocialPost({ results: { post: post.raw } })?.id).toBe("post_1");
    expect(extractSocialPosts({ results: { posts: [post.raw] } })).toHaveLength(1);
  });

  it("resolves userId from location users and attaches it on publish", async () => {
    expect(extractLocationUserIds({ users: [{ id: "user_abc", deleted: false }] })).toEqual(["user_abc"]);

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/users/")) {
        return jsonResponse({ users: [{ id: "user_abc", name: "Staff", deleted: false }] });
      }
      if (url.includes("/posts") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.status).toBe("published");
        expect(body.userId).toBe("user_abc");
        return jsonResponse(
          {
            results: {
              post: {
                _id: "post_live",
                summary: body.summary,
                status: "published",
                accountIds: body.accountIds,
                media: body.media,
                type: "post",
              },
            },
          },
          201,
        );
      }
      return jsonResponse({ message: `unhandled ${url}` }, 500);
    };

    const userId = await resolveSocialUserId(configuredDeps(fetchImpl));
    expect(userId).toBe("user_abc");

    const post = await createSocialPost(
      {
        accountIds: ["acc_1"],
        summary: "Live music this week at FloBama.",
        status: "published",
        media: weekSocialMediaItems({ formatId: "ig-square", origin: PRODUCTION_SITE_URL }),
      },
      configuredDeps(fetchImpl),
    );
    expect(post.id).toBe("post_live");
  });
});
