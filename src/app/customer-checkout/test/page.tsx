import { customerOrderStore } from "@/lib/customer/catalog";
import { formatUsd } from "@/lib/customer/money";
import { TestCheckout } from "./test-checkout";

export const dynamic = "force-dynamic";

export default async function CustomerTestCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order ?? "";
  const token = params.token ?? "";
  const orders = await customerOrderStore();
  const order = "error" in orders ? null : await orders.store.get(orderId);
  if (!order || order.accessToken !== token || order.checkoutMode !== "test") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center bg-neutral-950 px-6 text-neutral-100">
        <h1 className="text-3xl font-semibold">Checkout link expired</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 bg-neutral-950 px-6 text-neutral-100">
      <p className="text-sm font-semibold tracking-[0.2em] text-amber-400 uppercase">FloBama merch</p>
      <h1 className="text-3xl font-semibold">Test checkout</h1>
      <ul className="space-y-2">
        {order.items.map((item) => (
          <li key={item.productId} className="flex justify-between gap-4">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatUsd(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="text-lg font-semibold">Total {formatUsd(order.totalCents)}</p>
      <p className="text-sm text-neutral-400">{order.email}</p>
      <TestCheckout orderId={order.id} token={order.accessToken} />
    </main>
  );
}
