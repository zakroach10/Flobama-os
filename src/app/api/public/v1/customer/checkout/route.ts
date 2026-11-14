import { customerOrderStore, loadCustomerCatalog } from "@/lib/customer/catalog";
import { customerPublicOrigin, prepareCheckout } from "@/lib/customer/checkout";
import { customerJson, customerOptions } from "@/lib/customer/http";
import { classifyStripeSecret, merchStripeSecret } from "@/lib/customer/stripe";

export const dynamic = "force-dynamic";

const hits = new Map<string, { count: number; reset: number }>();

function rateLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = hits.get(ip);
  if (!current || current.reset < now) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 30;
}

export function OPTIONS() {
  return customerOptions();
}

export async function POST(request: Request) {
  if (rateLimit(request)) return customerJson({ error: "Too many checkout attempts. Try again in a minute." }, 429);
  let body: {
    email?: string;
    name?: string;
    items?: { productId?: string; quantity?: number }[];
    idempotencyKey?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return customerJson({ error: "Send a JSON checkout request." }, 400);
  }
  const loaded = await loadCustomerCatalog();
  if (loaded.error) return customerJson({ error: loaded.error }, loaded.missing ? 503 : 500);
  const orders = await customerOrderStore();
  if ("error" in orders) return customerJson({ error: orders.error }, 503);

  const lines = (body.items ?? []).map((item) => ({
    productId: String(item.productId ?? ""),
    quantity: Number(item.quantity),
  }));
  try {
    const result = await prepareCheckout({
      merch: loaded.catalog.merch,
      lines,
      email: body.email ?? "",
      name: body.name,
      idempotencyKey: body.idempotencyKey,
      store: orders.store,
      stripe: classifyStripeSecret(merchStripeSecret()),
      origin: customerPublicOrigin(request),
    });
    if (!result.ok) return customerJson({ error: result.error }, result.status);
    return customerJson({
      mode: result.mode,
      checkoutUrl: result.checkoutUrl,
      accessToken: result.accessToken,
      order: result.order,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return customerJson({ error: message }, 500);
  }
}
