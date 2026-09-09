import { z } from "zod";
import { publicOptions } from "@/lib/public/http";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEMO_TICKET_EVENT_ID, DEMO_TICKET_TYPES } from "@/lib/ticketing/demo";
import { completeDemoCheckout } from "@/lib/ticketing/memory-store";
import { chargeCheckout } from "@/lib/ticketing/payment";
import { getOrCreateTicketSession, publicTicketingJson } from "@/lib/ticketing/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

const schema = z.object({
  eventId: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().max(40).optional().nullable(),
  tickets: z
    .array(
      z.object({
        typeId: z.string(),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .default([]),
  mockFail: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return publicTicketingJson({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout." }, 400);
  const session = await getOrCreateTicketSession();
  const values = parsed.data;

  if (values.eventId === DEMO_TICKET_EVENT_ID || values.eventId === "demo") {
    const priced = values.tickets.map((ticket) => {
      const type = DEMO_TICKET_TYPES.find((item) => item.id === ticket.typeId);
      return {
        typeId: ticket.typeId,
        name: type?.name ?? "Ticket",
        quantity: ticket.quantity,
        unitPriceCents: type?.priceCents ?? 0,
      };
    });
    const amount = priced.reduce((sum, ticket) => sum + ticket.unitPriceCents * ticket.quantity, 0);
    const charge = await chargeCheckout({
      amountCents: amount,
      email: values.email,
      description: "FloBama tickets",
      mockFail: values.mockFail,
    });
    if (!charge.ok) return publicTicketingJson({ ok: false, error: charge.error }, 402);
    const result = completeDemoCheckout({
      session,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone ?? null,
      tickets: priced,
    });
    if (!result.ok) return publicTicketingJson(result, 409);
    return publicTicketingJson({
      ok: true,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      totalCents: result.order.totalCents,
      qrTokens: result.order.qrTokens,
      provider: charge.provider,
    });
  }

  const admin = createServiceRoleClient();
  if (!admin) return publicTicketingJson({ ok: false, error: "Ticketing is not configured." }, 503);

  for (const ticket of values.tickets) {
    const { data, error } = await admin.rpc("hold_ticket_type" as never, {
      p_type_id: ticket.typeId,
      p_quantity: ticket.quantity,
      p_session: session,
      p_minutes: 10,
    } as never);
    if (error) return publicTicketingJson({ ok: false, error: error.message }, 500);
    const held = data as { ok?: boolean; error?: string };
    if (held && held.ok === false) return publicTicketingJson({ ok: false, error: held.error }, 409);
  }

  const charge = await chargeCheckout({
    amountCents: 0,
    email: values.email,
    description: `FloBama order ${values.eventId}`,
    mockFail: values.mockFail,
  });
  if (!charge.ok) return publicTicketingJson({ ok: false, error: charge.error }, 402);

  const { data, error } = await admin.rpc("complete_ticketing_checkout" as never, {
    p_event_id: values.eventId,
    p_session: session,
    p_first_name: values.firstName,
    p_last_name: values.lastName,
    p_email: values.email,
    p_phone: values.phone ?? null,
    p_provider: charge.provider,
    p_provider_ref: charge.providerRef,
    p_payment_status: charge.status,
  } as never);
  if (error) return publicTicketingJson({ ok: false, error: error.message }, 500);
  const result = data as { ok?: boolean; error?: string; orderId?: string; orderNumber?: string; totalCents?: number };
  if (!result?.ok) return publicTicketingJson({ ok: false, error: result?.error ?? "Checkout failed." }, 409);
  const { data: tickets } = await admin.from("tickets" as never).select("qr_token").eq("order_id", result.orderId as string);
  return publicTicketingJson({
    ok: true,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    totalCents: result.totalCents,
    qrTokens: ((tickets ?? []) as Array<{ qr_token: string }>).map((row) => row.qr_token),
    provider: charge.provider,
  });
}
