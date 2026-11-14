"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateMerchOrderStatusAction } from "@/actions/customer-app";
import { formatUsd } from "@/lib/customer/money";
import { Button } from "@/components/ui/button";

type Order = {
  id: string;
  status: string;
  customer_email: string;
  customer_name: string | null;
  total_cents: number;
  created_at: string;
  items: { name: string; quantity: number; unitPriceCents: number }[];
};

export function OrdersTable({ orders, canEdit }: { orders: Order[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await updateMerchOrderStatusAction(id, status);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">No merch orders yet.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <article key={order.id} className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{order.customer_name || order.customer_email}</p>
              <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatUsd(order.total_cents)}</p>
              <p className="text-sm capitalize">{order.status}</p>
            </div>
          </div>
          <ul className="mt-3 text-sm">
            {order.items.map((item, index) => (
              <li key={`${order.id}-${index}`}>
                {item.quantity} × {item.name}
              </li>
            ))}
          </ul>
          {canEdit && order.status === "paid" ? (
            <Button className="mt-3" type="button" variant="outline" disabled={pending} onClick={() => setStatus(order.id, "fulfilled")}>
              Mark fulfilled
            </Button>
          ) : null}
          {canEdit && (order.status === "pending" || order.status === "paid") ? (
            <Button className="mt-3 ml-2" type="button" variant="outline" disabled={pending} onClick={() => setStatus(order.id, "cancelled")}>
              Cancel
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
