import { customerOrderStore } from "@/lib/customer/catalog";
import { completeCheckout } from "@/lib/customer/checkout";
import { customerJson, customerOptions } from "@/lib/customer/http";
import { classifyStripeSecret, merchStripeSecret } from "@/lib/customer/stripe";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function POST(request: Request) {
  let body: { orderId?: string; token?: string; sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return customerJson({ error: "Send a JSON confirmation." }, 400);
  }
  if (!body.orderId || !body.token) return customerJson({ error: "Order not found." }, 404);
  const orders = await customerOrderStore();
  if ("error" in orders) return customerJson({ error: orders.error }, 503);
  const order = await orders.store.get(body.orderId);
  if (!order || order.accessToken !== body.token) return customerJson({ error: "Order not found." }, 404);
  const result = await completeCheckout({
    order,
    token: body.token,
    store: orders.store,
    stripe: classifyStripeSecret(merchStripeSecret()),
    sessionId: body.sessionId,
  });
  if (!result.ok) return customerJson({ error: result.error }, result.status);
  return customerJson({ order: result.order });
}
