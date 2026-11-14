import { customerOrderStore } from "@/lib/customer/catalog";
import { verifyTimestampedSignature } from "@/lib/customer/signatures";
import { classifyStripeSecret, merchStripeSecret } from "@/lib/customer/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_MERCH_WEBHOOK_SECRET?.trim() ?? "";
  const raw = await request.text();
  if (!verifyTimestampedSignature({ header: request.headers.get("stripe-signature"), secret, rawBody: raw })) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }
  const stripe = classifyStripeSecret(merchStripeSecret());
  if (stripe.kind === "live") {
    return Response.json({ error: "Live Stripe keys are not accepted for merch." }, { status: 400 });
  }
  const event = JSON.parse(raw) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        metadata?: { order_id?: string };
        payment_status?: string;
        payment_intent?: string;
      };
    };
  };
  if (event.type !== "checkout.session.completed") return Response.json({ received: true });
  const session = event.data?.object;
  if (session?.payment_status !== "paid" || !session.metadata?.order_id) {
    return Response.json({ received: true });
  }
  const orders = await customerOrderStore();
  if ("error" in orders) return Response.json({ error: orders.error }, { status: 503 });
  const order = await orders.store.get(session.metadata.order_id);
  if (!order) return Response.json({ received: true });
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    return Response.json({ received: true });
  }
  if (order.status === "pending") {
    await orders.store.markPaid(order.id, session.payment_intent ?? null);
  }
  return Response.json({ received: true });
}
