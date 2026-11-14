import Link from "next/link";
import { customerOrderStore } from "@/lib/customer/catalog";
import { completeCheckout } from "@/lib/customer/checkout";
import { classifyStripeSecret } from "@/lib/customer/stripe";

export const dynamic = "force-dynamic";

export default async function CustomerCheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order ?? "";
  const token = params.token ?? "";
  let message = "Payment received. You can close this page and return to the FloBama app.";
  if (orderId && token) {
    const orders = await customerOrderStore();
    if ("error" in orders) {
      message = "The venue could not record this payment yet. Keep this page and try again in a moment.";
    } else {
      const order = await orders.store.get(orderId);
      if (!order || order.accessToken !== token) {
        message = "This checkout link is not valid.";
      } else {
        const result = await completeCheckout({
          order,
          token,
          store: orders.store,
          stripe: classifyStripeSecret(process.env.STRIPE_SECRET_KEY),
          sessionId: params.session_id,
        });
        if (!result.ok) message = result.error;
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 bg-neutral-950 px-6 text-neutral-100">
      <p className="text-sm font-semibold tracking-[0.2em] text-amber-400 uppercase">FloBama</p>
      <h1 className="text-3xl font-semibold">Order update</h1>
      <p className="text-neutral-300">{message}</p>
      {orderId && token ? (
        <Link className="text-amber-300 underline" href={`flobama://orders/${orderId}?token=${encodeURIComponent(token)}`}>
          Return to the app
        </Link>
      ) : null}
    </main>
  );
}
