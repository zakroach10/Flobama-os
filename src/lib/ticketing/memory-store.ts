import { DEMO_TICKET_EVENT_ID, demoTables, type PublicTable } from "@/lib/ticketing/demo";
import { TICKETING_HOLD_MINUTES } from "@/lib/ticketing/constants";
import { newCheckoutSessionToken, newQrToken } from "@/lib/ticketing/tokens";
import { applyFees } from "@/lib/ticketing/money";

type Hold = { tableId: string; session: string; expiresAt: number };
type TicketHold = { typeId: string; quantity: number; session: string; expiresAt: number };

const tables = new Map<string, PublicTable>(demoTables().map((table) => [table.id, { ...table }]));
const tableHolds: Hold[] = [];
const ticketHolds: TicketHold[] = [];
const orders: DemoOrder[] = [];

export type DemoOrder = {
  id: string;
  orderNumber: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  subtotalCents: number;
  feesCents: number;
  taxCents: number;
  totalCents: number;
  tableIds: string[];
  tableLabel: string | null;
  tickets: Array<{ typeId: string; name: string; quantity: number; unitPriceCents: number }>;
  qrTokens: string[];
  admissionsTotal: number;
  admissionsCheckedIn: number;
  createdAt: string;
};

function sweep(now = Date.now()) {
  for (const hold of [...tableHolds]) {
    if (hold.expiresAt <= now) {
      const table = tables.get(hold.tableId);
      if (table && table.status === "held") table.status = "available";
      const index = tableHolds.indexOf(hold);
      if (index >= 0) tableHolds.splice(index, 1);
    }
  }
  for (let i = ticketHolds.length - 1; i >= 0; i -= 1) {
    if (ticketHolds[i] && ticketHolds[i]!.expiresAt <= now) ticketHolds.splice(i, 1);
  }
}

export function listDemoTables() {
  sweep();
  return [...tables.values()].map((table) => ({ ...table }));
}

export function holdDemoTable(tableId: string, session: string) {
  sweep();
  const table = tables.get(tableId);
  if (!table) return { ok: false as const, error: "Table not found." };
  const existing = tableHolds.find((hold) => hold.tableId === tableId && hold.session === session);
  if (existing) {
    existing.expiresAt = Date.now() + TICKETING_HOLD_MINUTES * 60_000;
    table.status = "held";
    return { ok: true as const, holdUntil: new Date(existing.expiresAt).toISOString() };
  }
  if (table.status !== "available") return { ok: false as const, error: "Table is no longer available." };
  table.status = "held";
  const expiresAt = Date.now() + TICKETING_HOLD_MINUTES * 60_000;
  tableHolds.push({ tableId, session, expiresAt });
  return { ok: true as const, holdUntil: new Date(expiresAt).toISOString() };
}

export function holdDemoTickets(typeId: string, quantity: number, session: string) {
  sweep();
  const expiresAt = Date.now() + TICKETING_HOLD_MINUTES * 60_000;
  for (let i = ticketHolds.length - 1; i >= 0; i -= 1) {
    if (ticketHolds[i]?.session === session && ticketHolds[i]?.typeId === typeId) ticketHolds.splice(i, 1);
  }
  ticketHolds.push({ typeId, quantity, session, expiresAt });
  return { ok: true as const, holdUntil: new Date(expiresAt).toISOString() };
}

export function completeDemoCheckout(input: {
  session: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  tickets: Array<{ typeId: string; name: string; quantity: number; unitPriceCents: number }>;
}) {
  sweep();
  const heldTables = tableHolds.filter((hold) => hold.session === input.session);
  const heldTickets = ticketHolds.filter((hold) => hold.session === input.session);
  if (heldTables.length === 0 && heldTickets.length === 0 && input.tickets.length === 0) {
    return { ok: false as const, error: "Your hold expired. Nothing was purchased." };
  }
  let subtotal = 0;
  for (const ticket of input.tickets) subtotal += ticket.unitPriceCents * ticket.quantity;
  const tableIds: string[] = [];
  let admissionsTotal = input.tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  for (const hold of heldTables) {
    const table = tables.get(hold.tableId);
    if (!table || table.status !== "held") {
      return { ok: false as const, error: "A table hold expired during checkout." };
    }
    subtotal += table.priceCents;
    table.status = "sold";
    tableIds.push(table.id);
    admissionsTotal += table.capacity;
  }
  const tableLabel = tableIds.length ? (tables.get(tableIds[0]!)?.name ?? tableIds[0]!) : null;
  const { fees, tax, total } = applyFees(subtotal, 0, 0);
  const qrTokens = Array.from({ length: Math.max(1, tableIds.length + input.tickets.reduce((s, t) => s + t.quantity, 0)) }, () =>
    newQrToken(),
  );
  const order: DemoOrder = {
    id: crypto.randomUUID(),
    orderNumber: `FB-DEMO-${newCheckoutSessionToken().slice(0, 5).toUpperCase()}`,
    eventId: DEMO_TICKET_EVENT_ID,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    subtotalCents: subtotal,
    feesCents: fees,
    taxCents: tax,
    totalCents: total,
    tableIds,
    tableLabel,
    tickets: input.tickets,
    qrTokens,
    admissionsTotal,
    admissionsCheckedIn: 0,
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  for (let i = tableHolds.length - 1; i >= 0; i -= 1) {
    if (tableHolds[i]?.session === input.session) tableHolds.splice(i, 1);
  }
  for (let i = ticketHolds.length - 1; i >= 0; i -= 1) {
    if (ticketHolds[i]?.session === input.session) ticketHolds.splice(i, 1);
  }
  return { ok: true as const, order };
}

export function getDemoOrderByQr(token: string) {
  return orders.find((order) => order.qrTokens.includes(token)) ?? null;
}

export function getDemoOrder(id: string) {
  return orders.find((order) => order.id === id || order.orderNumber === id) ?? null;
}

export function checkInDemoOrder(id: string, quantity: number) {
  const order = getDemoOrder(id);
  if (!order) return { ok: false as const, error: "Ticket not found." };
  if (order.admissionsCheckedIn + quantity > order.admissionsTotal) {
    return { ok: false as const, error: "That would exceed remaining admissions." };
  }
  order.admissionsCheckedIn += quantity;
  return { ok: true as const, order };
}

export function listDemoOrders() {
  return [...orders];
}

export function searchDemoOrders(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return listDemoOrders();
  return listDemoOrders().filter((order) => {
    const haystack = [
      order.orderNumber,
      order.firstName,
      order.lastName,
      `${order.firstName} ${order.lastName}`,
      order.email,
      order.phone ?? "",
      order.tableLabel ?? "",
      ...order.tableIds,
      ...order.qrTokens,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
