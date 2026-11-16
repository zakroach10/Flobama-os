import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { customerShowCutoff, PAST_SHOW_LIMIT, selectCustomerShowWindow, UPCOMING_SHOW_LIMIT } from "@/lib/customer/catalog";
import { buildFixtureCatalog, SEEDED_MERCH } from "@/lib/customer/fixtures";
import { dollarsToCents, formatUsd, priceCart } from "@/lib/customer/money";
import { mapShow, publicHttpUrl, showHasOnlyPublicKeys } from "@/lib/customer/public-map";
import { verifyTimestampedSignature } from "@/lib/customer/signatures";
import { getLiveState, hlsFromPlaybackId, parsePlaybackId, type MuxEnv } from "@/lib/customer/stream";
import { classifyStripeSecret, stripeCheckoutForm } from "@/lib/customer/stripe";
import { completeCheckout, memoryOrderStore, prepareCheckout, resetMemoryOrders } from "@/lib/customer/checkout";

const blankMux = (overrides: Partial<MuxEnv> = {}): MuxEnv => ({
  tokenId: "",
  tokenSecret: "",
  liveStreamId: "",
  playbackId: "",
  fixture: "",
  webhookSecret: "",
  ...overrides,
});

describe("customer catalog safety", () => {
  it("drops non-http links and staff-only show fields", () => {
    expect(publicHttpUrl("javascript:alert(1)")).toBeNull();
    expect(publicHttpUrl("https://flobamadowntown.com/tickets")).toContain("https://");
    const show = mapShow({
      id: "55555555-5555-4555-8555-555555555501",
      title: "The KGB Band",
      public_description: "Doors at 7.",
      event_type: "live_music",
      starts_at: "2026-11-20T02:00:00.000Z",
      ends_at: "2026-11-20T05:00:00.000Z",
      location_label: "Main room",
      featured: true,
      is_ticketed: false,
      ticket_url: "javascript:alert(1)",
      cover_label: null,
      artists: [{ id: "44444444-4444-4444-8444-444444444401", name: "The KGB Band", genre: "Southern rock", display_order: 0 }],
    });
    expect(show.ticketUrl).toBeNull();
    expect(showHasOnlyPublicKeys(show)).toBe(true);
    expect(JSON.stringify(show)).not.toMatch(/internal_notes|javascript:/);
  });

  it("keeps sample shows in the future and uses the seeded menu prices", () => {
    const now = new Date("2026-11-14T18:00:00.000Z");
    const catalog = buildFixtureCatalog(now);
    const upcoming = catalog.shows.filter((show) => show.endsAt > now.toISOString());
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((show) => show.startsAt > now.toISOString())).toBe(true);
    expect(catalog.menu.map((item) => item.name)).toContain("FloBama Wings");
    expect(catalog.merch.map((item) => item.priceCents)).toEqual([2800, 2400, 600]);
    expect(catalog.recordings[0]?.playbackUrl).toContain(".m3u8");
  });
});

describe("customer show window", () => {
  it("keeps future shows when more than 80 past shows would fill an oldest-first page", () => {
    const now = new Date("2026-11-14T18:00:00.000Z");
    const hour = 60 * 60 * 1000;
    const past = Array.from({ length: 88 }, (_, index) => {
      const starts = new Date(now.getTime() - (20 + index) * 24 * hour);
      return {
        id: `past-${index}`,
        title: `Past ${index}`,
        starts_at: starts.toISOString(),
        ends_at: new Date(starts.getTime() + 3 * hour).toISOString(),
        artistId: "artist-past",
      };
    });
    const inProgressStart = new Date(now.getTime() - 2 * hour);
    const inProgress = {
      id: "tonight",
      title: "On stage now",
      starts_at: inProgressStart.toISOString(),
      ends_at: new Date(now.getTime() + 2 * hour).toISOString(),
      artistId: "artist-live",
    };
    const future = Array.from({ length: 18 }, (_, index) => {
      const starts = new Date(now.getTime() + (index + 1) * 24 * hour);
      return {
        id: `future-${index}`,
        title: `Future ${index}`,
        starts_at: starts.toISOString(),
        ends_at: new Date(starts.getTime() + 3 * hour).toISOString(),
        artistId: "artist-live",
      };
    });
    const rows = [...past, ...future, inProgress];

    const oldestPage = [...rows].sort((left, right) => left.starts_at.localeCompare(right.starts_at)).slice(0, 80);
    expect(oldestPage.some((row) => row.starts_at >= now.toISOString())).toBe(false);
    expect(oldestPage.some((row) => row.id === "tonight")).toBe(false);

    const windowed = selectCustomerShowWindow(rows, now);
    const nowIso = now.toISOString();
    const stillOn = windowed.filter((row) => row.ends_at > nowIso);
    expect(stillOn.map((row) => row.id)).toEqual(["tonight", ...future.map((row) => row.id)]);
    expect(stillOn[0]?.id).toBe("tonight");
    expect(windowed.filter((row) => row.starts_at < customerShowCutoff(now)).length).toBe(PAST_SHOW_LIMIT);
    expect(windowed.some((row) => row.id === "past-87")).toBe(false);
    expect(windowed.find((row) => row.id === "future-0")).toBeTruthy();
    expect(windowed.filter((row) => row.artistId === "artist-live" && row.ends_at > nowIso)).toHaveLength(19);
    expect(UPCOMING_SHOW_LIMIT).toBeGreaterThanOrEqual(stillOn.length);
  });
});

describe("merch pricing", () => {
  it("prices from the catalog, not from the client", () => {
    const priced = priceCart(SEEDED_MERCH, [
      { productId: SEEDED_MERCH[0]!.id, quantity: 2 },
      { productId: SEEDED_MERCH[2]!.id, quantity: 1 },
    ]);
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.totalCents).toBe(2800 * 2 + 600);
    expect(priced.items[0]?.unitPriceCents).toBe(2800);
    expect(priceCart(SEEDED_MERCH, [{ productId: "missing", quantity: 1 }]).ok).toBe(false);
    expect(priceCart(SEEDED_MERCH, [{ productId: SEEDED_MERCH[0]!.id, quantity: 9 }]).ok).toBe(false);
    expect(dollarsToCents("28")).toBe(2800);
    expect(dollarsToCents("0.10")).toBeNull();
    expect(formatUsd(2800)).toBe("$28.00");
  });

  it("refuses live Stripe keys and accepts only test secrets for merch", () => {
    expect(classifyStripeSecret(undefined).kind).toBe("unset");
    expect(classifyStripeSecret("sk_test_123").kind).toBe("test");
    expect(classifyStripeSecret("sk_live_123").kind).toBe("live");
    expect(classifyStripeSecret("rk_live_123").kind).toBe("live");
    expect(classifyStripeSecret("pk_test_123").kind).toBe("invalid");
  });
});

describe("checkout", () => {
  it("records a test order without calling Stripe", async () => {
    resetMemoryOrders();
    const store = memoryOrderStore();
    const created = await prepareCheckout({
      merch: SEEDED_MERCH,
      lines: [{ productId: SEEDED_MERCH[1]!.id, quantity: 1 }],
      email: "guest@example.com",
      idempotencyKey: "repeat-key-1",
      store,
      stripe: { kind: "unset" },
      origin: "http://localhost:43123",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.mode).toBe("test");
    expect(created.order.totalCents).toBe(2400);
    const again = await prepareCheckout({
      merch: SEEDED_MERCH,
      lines: [{ productId: SEEDED_MERCH[0]!.id, quantity: 1 }],
      email: "guest@example.com",
      idempotencyKey: "repeat-key-1",
      store,
      stripe: { kind: "unset" },
      origin: "http://localhost:43123",
    });
    expect(again.ok && again.order.id).toBe(created.order.id);
    const paid = await completeCheckout({
      order: (await store.get(created.order.id))!,
      token: created.accessToken,
      store,
      stripe: { kind: "unset" },
    });
    expect(paid.ok && paid.order.status).toBe("paid");
    const wrong = await completeCheckout({
      order: (await store.get(created.order.id))!,
      token: "nope",
      store,
      stripe: { kind: "unset" },
    });
    expect(wrong.ok).toBe(false);
  });

  it("refuses a live key and only marks Stripe orders paid after Stripe says so", async () => {
    resetMemoryOrders();
    const store = memoryOrderStore();
    const refused = await prepareCheckout({
      merch: SEEDED_MERCH,
      lines: [{ productId: SEEDED_MERCH[2]!.id, quantity: 1 }],
      email: "guest@example.com",
      store,
      stripe: { kind: "live" },
      origin: "http://localhost:43123",
    });
    expect(refused.ok).toBe(false);

    let stripeBody = "";
    const created = await prepareCheckout({
      merch: SEEDED_MERCH,
      lines: [{ productId: SEEDED_MERCH[2]!.id, quantity: 2 }],
      email: "guest@example.com",
      store,
      stripe: { kind: "test", key: "sk_test_example" },
      origin: "http://localhost:43123",
      fetchImpl: async (_url, init) => {
        stripeBody = String(init?.body ?? "");
        return new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.mode).toBe("stripe");
    expect(decodeURIComponent(stripeBody)).toContain("[unit_amount]=600");
    expect(stripeBody).not.toContain("sk_test");
    const form = stripeCheckoutForm({
      orderId: created.order.id,
      email: "guest@example.com",
      currency: "usd",
      items: [{ name: "FloBama Koozie", quantity: 2, unitPriceCents: 600 }],
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
    });
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("600");

    const unpaid = await completeCheckout({
      order: (await store.get(created.order.id))!,
      token: created.accessToken,
      store,
      stripe: { kind: "test", key: "sk_test_example" },
      fetchImpl: async () =>
        new Response(JSON.stringify({ payment_status: "unpaid", payment_intent: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    expect(unpaid.ok).toBe(false);
    const paid = await completeCheckout({
      order: (await store.get(created.order.id))!,
      token: created.accessToken,
      store,
      stripe: { kind: "test", key: "sk_test_example" },
      fetchImpl: async () =>
        new Response(JSON.stringify({ payment_status: "paid", payment_intent: "pi_test_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    expect(paid.ok && paid.order.status).toBe("paid");
  });
});

describe("live stream", () => {
  it("stays offline without Mux credentials unless the preview fixture is on", async () => {
    const offline = await getLiveState(blankMux());
    expect(offline.live).toBe(false);
    expect(offline.playbackUrl).toBeNull();
    const preview = await getLiveState(blankMux({ fixture: "live" }));
    expect(preview.live).toBe(true);
    expect(preview.preview).toBe(true);
    expect(preview.playbackUrl).toContain(".m3u8");
  });

  it("shows Live now only when Mux reports an active stream", async () => {
    const env = blankMux({ tokenId: "id", tokenSecret: "secret", liveStreamId: "stream" });
    const idle = await getLiveState(env, async () =>
      new Response(JSON.stringify({ data: { status: "idle", playback_ids: [{ id: "publicPlaybackId", policy: "public" }] } }), {
        status: 200,
      }),
    );
    expect(idle.live).toBe(false);
    expect(idle.playbackUrl).toBeNull();
    const active = await getLiveState(env, async (url, init) => {
      expect(String(url)).toContain("/video/v1/live-streams/stream");
      expect(String((init?.headers as Record<string, string>).Authorization)).toContain("Basic ");
      return new Response(JSON.stringify({ data: { status: "active", playback_ids: [{ id: "publicPlaybackId", policy: "public" }] } }), {
        status: 200,
      });
    });
    expect(active.live).toBe(true);
    expect(active.preview).toBe(false);
    expect(active.playbackUrl).toBe(hlsFromPlaybackId("publicPlaybackId"));
    expect(parsePlaybackId("https://stream.mux.com/publicPlaybackId.m3u8")).toBe("publicPlaybackId");
  });
});

describe("webhook signatures", () => {
  it("accepts a fresh Mux or Stripe signature and rejects a stale one", () => {
    const secret = "whsec_test";
    const raw = JSON.stringify({ type: "video.asset.ready" });
    const now = 1_700_000_000_000;
    const timestamp = String(Math.floor(now / 1000));
    const signature = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyTimestampedSignature({ header, secret, rawBody: raw, nowMs: now })).toBe(true);
    expect(verifyTimestampedSignature({ header, secret, rawBody: raw, nowMs: now + 10 * 60 * 1000 })).toBe(false);
    expect(verifyTimestampedSignature({ header: `t=${timestamp},v1=deadbeef`, secret, rawBody: raw, nowMs: now })).toBe(false);
    expect(verifyTimestampedSignature({ header: null, secret, rawBody: raw })).toBe(false);
  });
});
