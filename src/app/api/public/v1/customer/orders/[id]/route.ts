import { customerOrderStore } from "@/lib/customer/catalog";
import { toPublicOrder } from "@/lib/customer/checkout";
import { customerJson, customerOptions } from "@/lib/customer/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return customerOptions();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const orders = await customerOrderStore();
  if ("error" in orders) return customerJson({ error: orders.error }, 503);
  const order = await orders.store.get(id);
  if (!order || order.accessToken !== token) return customerJson({ error: "Order not found." }, 404);
  return customerJson({ order: toPublicOrder(order) });
}
