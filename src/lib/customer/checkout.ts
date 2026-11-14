import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { priceCart } from "@/lib/customer/money";
import {
  classifyStripeSecret,
  createStripeCheckoutSession,
  merchStripeSecret,
  retrieveStripeCheckoutSession,
  stripeCheckoutForm,
  type StripeKeyClass,
} from "@/lib/customer/stripe";
import type { CustomerMerch, PublicOrder, StoredOrder } from "@/lib/customer/types";

export type OrderStore = {
  put(order: StoredOrder): Promise<void>;
  get(id: string): Promise<StoredOrder | null>;
  findByIdempotency(key: string): Promise<StoredOrder | null>;
  markPaid(id: string, paymentIntentId: string | null): Promise<StoredOrder | null>;
};

const memory = new Map<string, StoredOrder>();

export function resetMemoryOrders() {
  memory.clear();
}

export function memoryOrderStore(): OrderStore {
  return {
    async put(order) {
      memory.set(order.id, order);
    },
    async get(id) {
      return memory.get(id) ?? null;
    },
    async findByIdempotency(key) {
      return [...memory.values()].find((order) => order.idempotencyKey === key) ?? null;
    },
    async markPaid(id, paymentIntentId) {
      const current = memory.get(id);
      if (!current) return null;
      const next: StoredOrder = {
        ...current,
        status: current.status === "fulfilled" ? "fulfilled" : "paid",
        stripePaymentIntentId: paymentIntentId ?? current.stripePaymentIntentId,
      };
      memory.set(id, next);
      return next;
    },
  };
}

export function toPublicOrder(order: StoredOrder): PublicOrder {
  return {
    id: order.id,
    status: order.status,
    email: order.email,
    totalCents: order.totalCents,
    currency: order.currency,
    items: order.items,
    createdAt: order.createdAt,
    checkoutUrl: order.checkoutUrl,
    mode: order.checkoutMode,
  };
}

export function customerPublicOrigin(request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  if (/localhost|127\.0\.0\.1/.test(requestOrigin)) return requestOrigin;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return configured || requestOrigin;
}

function checkoutUrls(origin: string, orderId: string, token: string) {
  const query = `order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;
  return {
    successUrl: `${origin}/customer-checkout/return?${query}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/customer-checkout/cancel?${query}`,
    testUrl: `${origin}/customer-checkout/test?${query}`,
  };
}

export async function prepareCheckout(input: {
  merch: CustomerMerch[];
  lines: { productId: string; quantity: number }[];
  email: string;
  name?: string | null;
  idempotencyKey?: string | null;
  store: OrderStore;
  stripe?: StripeKeyClass;
  origin: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<
  { ok: true; order: PublicOrder; accessToken: string; checkoutUrl: string; mode: "test" | "stripe" } | { ok: false; status: number; error: string }
> {
  const email = input.email.trim().toLowerCase();
  if (!z.email().safeParse(email).success) {
    return { ok: false, status: 400, error: "Enter a valid email." };
  }
  const name = input.name?.trim() ? input.name.trim().slice(0, 120) : null;
  const stripe = input.stripe ?? classifyStripeSecret(merchStripeSecret());
  if (stripe.kind === "live" || stripe.kind === "invalid") {
    return { ok: false, status: 400, error: "Merch checkout only runs with a Stripe test key (sk_test_), or with no key for the in-app test checkout." };
  }
  const priced = priceCart(input.merch, input.lines);
  if (!priced.ok) return { ok: false, status: 400, error: priced.error };

  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey && !/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) {
    return { ok: false, status: 400, error: "That checkout could not be repeated. Start again." };
  }
  if (idempotencyKey) {
    const existing = await input.store.findByIdempotency(idempotencyKey);
    if (existing) {
      return {
        ok: true,
        order: toPublicOrder(existing),
        accessToken: existing.accessToken,
        checkoutUrl: existing.checkoutUrl,
        mode: existing.checkoutMode,
      };
    }
  }

  const id = randomUUID();
  const accessToken = randomBytes(24).toString("hex");
  const urls = checkoutUrls(input.origin, id, accessToken);
  const createdAt = (input.now ?? new Date()).toISOString();
  const base: StoredOrder = {
    id,
    venueId: FLO_BAMA_VENUE_ID,
    status: "pending",
    email,
    name,
    totalCents: priced.totalCents,
    currency: "usd",
    accessToken,
    checkoutMode: "test",
    checkoutUrl: urls.testUrl,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    idempotencyKey,
    items: priced.items,
    createdAt,
  };

  if (stripe.kind === "unset") {
    await input.store.put(base);
    return { ok: true, order: toPublicOrder(base), accessToken, checkoutUrl: base.checkoutUrl, mode: "test" };
  }

  const session = await createStripeCheckoutSession({
    secretKey: stripe.key,
    idempotencyKey: idempotencyKey ?? id,
    fetchImpl: input.fetchImpl,
    form: stripeCheckoutForm({
      orderId: id,
      email,
      currency: "usd",
      items: priced.items,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    }),
  });
  if (!session.ok) return { ok: false, status: 502, error: "Stripe could not start checkout." };

  const stored: StoredOrder = {
    ...base,
    checkoutMode: "stripe",
    checkoutUrl: session.url,
    stripeCheckoutSessionId: session.id,
  };
  await input.store.put(stored);
  return { ok: true, order: toPublicOrder(stored), accessToken, checkoutUrl: stored.checkoutUrl, mode: "stripe" };
}

export async function completeCheckout(input: {
  order: StoredOrder;
  token: string;
  store: OrderStore;
  stripe?: StripeKeyClass;
  sessionId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; order: PublicOrder } | { ok: false; status: number; error: string }> {
  if (input.token !== input.order.accessToken) {
    return { ok: false, status: 404, error: "Order not found." };
  }
  if (input.order.status === "paid" || input.order.status === "fulfilled") {
    return { ok: true, order: toPublicOrder(input.order) };
  }
  if (input.order.status !== "pending") {
    return { ok: false, status: 409, error: "This order can no longer be paid." };
  }

  const stripe = input.stripe ?? classifyStripeSecret(merchStripeSecret());
  if (input.order.checkoutMode === "test") {
    const paid = await input.store.markPaid(input.order.id, null);
    if (!paid) return { ok: false, status: 404, error: "Order not found." };
    return { ok: true, order: toPublicOrder(paid) };
  }

  if (stripe.kind !== "test") {
    return { ok: false, status: 400, error: "A Stripe test key is required to confirm this payment." };
  }
  const sessionId = input.sessionId?.trim() || input.order.stripeCheckoutSessionId;
  if (!sessionId) return { ok: false, status: 400, error: "Stripe has not finished this checkout." };
  const session = await retrieveStripeCheckoutSession({
    secretKey: stripe.key,
    sessionId,
    fetchImpl: input.fetchImpl,
  });
  if (!session.ok) return { ok: false, status: 502, error: "Stripe could not confirm the payment." };
  if (session.paymentStatus !== "paid") {
    return { ok: false, status: 402, error: "Payment is not complete." };
  }
  const paid = await input.store.markPaid(input.order.id, session.paymentIntentId);
  if (!paid) return { ok: false, status: 404, error: "Order not found." };
  return { ok: true, order: toPublicOrder(paid) };
}
