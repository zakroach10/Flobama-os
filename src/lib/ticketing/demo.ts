import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import type { TableInventoryStatus } from "@/lib/ticketing/constants";

export const DEMO_TICKET_EVENT_ID = "demo-ticketing-event";

export function isDemoTicketingEvent(id: string) {
  return id === DEMO_TICKET_EVENT_ID || id === "demo";
}

export type PublicTicketType = {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  kind: "ga" | "vip" | "other";
  priceCents: number;
  maxPerOrder: number;
  remaining: number;
  sortOrder: number;
};

export type PublicTable = {
  id: string;
  eventId: string;
  name: string;
  tableNumber: string | null;
  section: string | null;
  capacity: number;
  priceCents: number;
  vip: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: "rect" | "round" | "ellipse";
  objectType: string;
  status: TableInventoryStatus;
};

export type PublicTicketEvent = {
  id: string;
  title: string;
  artists: string[];
  description: string | null;
  startsAt: string;
  endsAt: string;
  doorsAt: string | null;
  locationLabel: string | null;
  tablesEnabled: boolean;
  refundPolicy: string | null;
  ageRestriction: string | null;
  parkingNotes: string | null;
  venueNotes: string | null;
  holdMinutes: number;
  maxTicketsPerOrder: number;
  canvasWidth: number;
  canvasHeight: number;
};

function table(
  n: number,
  x: number,
  y: number,
  vip = false,
): PublicTable {
  return {
    id: `demo-table-${n}`,
    eventId: DEMO_TICKET_EVENT_ID,
    name: `Table ${n}`,
    tableNumber: String(n),
    section: vip ? "VIP" : n <= 16 ? "Main floor" : "Rear",
    capacity: vip ? 6 : 4,
    priceCents: vip ? 25000 : 15000,
    vip,
    x,
    y,
    width: 88,
    height: 64,
    rotation: 0,
    shape: "round",
    objectType: "table",
    status: n === 3 ? "sold" : n === 7 ? "blocked" : "available",
  };
}

export function demoTables(): PublicTable[] {
  const tables: PublicTable[] = [];
  for (let n = 1; n <= 8; n += 1) tables.push(table(n, 140, 140 + (n - 1) * 78));
  for (let n = 9; n <= 16; n += 1) tables.push(table(n, 980, 140 + (n - 9) * 78));
  for (let n = 17; n <= 22; n += 1) tables.push(table(n, 180 + ((n - 17) % 6) * 140, 520));
  for (let n = 23; n <= 28; n += 1) tables.push(table(n, 180 + ((n - 23) % 6) * 140, 620, n >= 25));
  return tables;
}

export const DEMO_TICKET_TYPES: PublicTicketType[] = [
  {
    id: "demo-ga",
    eventId: DEMO_TICKET_EVENT_ID,
    name: "General Admission",
    description: "Standing room and dance floor. First come, first served at the door.",
    kind: "ga",
    priceCents: 2000,
    maxPerOrder: 8,
    remaining: 214,
    sortOrder: 0,
  },
  {
    id: "demo-vip",
    eventId: DEMO_TICKET_EVENT_ID,
    name: "VIP Admission",
    description: "Priority entry and VIP rail access. Does not include a reserved table.",
    kind: "vip",
    priceCents: 4000,
    maxPerOrder: 6,
    remaining: 32,
    sortOrder: 1,
  },
];

export const DEMO_TICKET_EVENT: PublicTicketEvent = {
  id: DEMO_TICKET_EVENT_ID,
  title: DEMO_WEEK_SLIDE.days[0]?.events[0]?.name
    ? "Slaw Dogs"
    : "Friday night live",
  artists: ["Slaw Dogs"],
  description:
    "Live on the FloBama stage. Doors at 7, music around 8. Whole tables include admission for everyone seated there.",
  startsAt: "2026-09-12T01:00:00.000Z",
  endsAt: "2026-09-12T05:00:00.000Z",
  doorsAt: "2026-09-12T00:00:00.000Z",
  locationLabel: "FloBama Music Hall · Downtown Florence",
  tablesEnabled: true,
  refundPolicy: "Tickets and table reservations are non-refundable except when FloBama cancels the show.",
  ageRestriction: "21+ with valid ID",
  parkingNotes: "Street parking around Downtown Florence. Do not block the alley.",
  venueNotes: "FloBama Music Hall, Downtown Florence, Alabama.",
  holdMinutes: 10,
  maxTicketsPerOrder: 8,
  canvasWidth: 1200,
  canvasHeight: 860,
};

export const DEMO_DECOR = [
  { id: "stage", type: "stage", name: "Stage", x: 360, y: 24, width: 480, height: 88 },
  { id: "floor", type: "dance_floor", name: "Dance floor", x: 360, y: 128, width: 480, height: 200 },
  { id: "bar", type: "bar", name: "Bar", x: 24, y: 160, width: 88, height: 420 },
  { id: "door", type: "entrance", name: "Entrance", x: 520, y: 800, width: 160, height: 40 },
];
