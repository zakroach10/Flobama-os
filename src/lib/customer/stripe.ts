export type StripeKeyClass =
  | { kind: "unset" }
  | { kind: "test"; key: string }
  | { kind: "live" }
  | { kind: "invalid" };

/** Merch uses its own test key so ticket checkout can keep STRIPE_SECRET_KEY unset. */
export function merchStripeSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.STRIPE_MERCH_SECRET_KEY;
}

export function classifyStripeSecret(secret: string | undefined | null): StripeKeyClass {
  const key = secret?.trim() ?? "";
  if (!key) return { kind: "unset" };
  if (key.startsWith("sk_test_")) return { kind: "test", key };
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return { kind: "live" };
  return { kind: "invalid" };
}

export type StripeLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export function stripeCheckoutForm(input: {
  orderId: string;
  email: string;
  currency: "usd";
  items: StripeLine[];
  successUrl: string;
  cancelUrl: string;
}): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("customer_email", input.email);
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.orderId);
  body.set("metadata[order_id]", input.orderId);
  input.items.forEach((item, index) => {
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
    body.set(`line_items[${index}][price_data][currency]`, input.currency);
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitPriceCents));
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });
  return body;
}

export async function createStripeCheckoutSession(input: {
  secretKey: string;
  form: URLSearchParams;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: input.form.toString(),
  });
  const payload = (await response.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null;
  if (!response.ok || !payload?.id || !payload.url) {
    return { ok: false, error: payload?.error?.message || "Stripe could not start checkout." };
  }
  return { ok: true, id: payload.id, url: payload.url };
}

export async function retrieveStripeCheckoutSession(input: {
  secretKey: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; paymentStatus: string; paymentIntentId: string | null } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.sessionId)}`, {
    headers: { Authorization: `Bearer ${input.secretKey}` },
  });
  const payload = (await response.json().catch(() => null)) as {
    payment_status?: string;
    payment_intent?: string | { id?: string } | null;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.payment_status) {
    return { ok: false, error: payload?.error?.message || "Stripe could not confirm the payment." };
  }
  const paymentIntent = payload.payment_intent;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null;
  return { ok: true, paymentStatus: payload.payment_status, paymentIntentId };
}
