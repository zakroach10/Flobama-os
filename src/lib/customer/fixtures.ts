import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { MUX_FIXTURE_PLAYBACK } from "@/lib/customer/stream";
import type { CustomerCatalog, CustomerMenuItem, CustomerMerch } from "@/lib/customer/types";

export const SEEDED_MENU: CustomerMenuItem[] = [
  { id: "22222222-2222-4222-8222-222222222201", category: "Starters & Wings", name: "FloBama Wings", description: "Crispy wings tossed in house sauce.", priceLabel: "$14", sortOrder: 10 },
  { id: "22222222-2222-4222-8222-222222222202", category: "Starters & Wings", name: "Loaded Fries", description: "Fries with queso, bacon, and green onion.", priceLabel: "$9", sortOrder: 20 },
  { id: "22222222-2222-4222-8222-222222222203", category: "Starters & Wings", name: "Nachos", description: "Shareable nachos with queso and jalapeños.", priceLabel: "$11", sortOrder: 30 },
  { id: "22222222-2222-4222-8222-222222222204", category: "Smoked Meats", name: "Pulled Pork Plate", description: "Slow-smoked pulled pork with two sides.", priceLabel: "$16", sortOrder: 10 },
  { id: "22222222-2222-4222-8222-222222222205", category: "Smoked Meats", name: "Rib Plate", description: "Dry-rubbed ribs with two sides.", priceLabel: "$22", sortOrder: 20 },
  { id: "22222222-2222-4222-8222-222222222206", category: "Smoked Meats", name: "Brisket Plate", description: "Sliced brisket with two sides.", priceLabel: "$18", sortOrder: 30 },
  { id: "22222222-2222-4222-8222-222222222207", category: "Burgers & Sandwiches", name: "FloBama Burger", description: "Hand-pressed burger with American cheese.", priceLabel: "$14", sortOrder: 10 },
  { id: "22222222-2222-4222-8222-222222222208", category: "Burgers & Sandwiches", name: "Brisket Sandwich", description: "Smoked brisket on a toasted bun.", priceLabel: "$15", sortOrder: 20 },
  { id: "22222222-2222-4222-8222-222222222209", category: "Drinks", name: "Draft Beer", description: "Ask the bar for what is on tap.", priceLabel: "$6", sortOrder: 10 },
  { id: "22222222-2222-4222-8222-222222222210", category: "Drinks", name: "Sweet Tea", description: "House sweet tea.", priceLabel: "$3", sortOrder: 20 },
];

export const SEEDED_MERCH: CustomerMerch[] = [
  { id: "33333333-3333-4333-8333-333333333301", name: "FloBama Tee", description: "Black tee with the FloBama wordmark. Ask the bar for sizes.", priceCents: 2800, currency: "usd", imageUrl: null, sku: "TEE", sortOrder: 10 },
  { id: "33333333-3333-4333-8333-333333333302", name: "FloBama Hat", description: "Embroidered hat. Pickup at the bar.", priceCents: 2400, currency: "usd", imageUrl: null, sku: "HAT", sortOrder: 20 },
  { id: "33333333-3333-4333-8333-333333333303", name: "FloBama Koozie", description: "Keeps a cold one cold through the set.", priceCents: 600, currency: "usd", imageUrl: null, sku: "KOOZIE", sortOrder: 30 },
];

function atHour(day: DateTime, hour: number) {
  return day.set({ hour, minute: 0, second: 0, millisecond: 0 });
}

/** Sample schedule used when Supabase is not configured, or CUSTOMER_APP_FIXTURES=1. */
export function buildFixtureCatalog(now: Date = new Date()): CustomerCatalog {
  const zone = DEFAULT_VENUE_TIMEZONE;
  const base = DateTime.fromJSDate(now, { zone: "utc" }).setZone(zone);
  const daysUntilFriday = (5 - base.weekday + 7) % 7 || 7;
  const friday = atHour(base.plus({ days: daysUntilFriday }), 20);
  const saturday = atHour(friday.plus({ days: 1 }), 20);
  const past = atHour(base.minus({ days: 12 }), 20);

  const kgb = { id: "44444444-4444-4444-8444-444444444401", name: "The KGB Band", genre: "Southern rock" };
  const shoals = { id: "44444444-4444-4444-8444-444444444402", name: "Shoals Revival", genre: "Soul" };
  const maple = { id: "44444444-4444-4444-8444-444444444403", name: "Maple Street Duo", genre: "Acoustic" };

  return {
    artists: [
      { ...kgb, bio: "A Florence favorite. Sample listing until staff publish artists from FloBama OS.", websiteUrl: null },
      { ...shoals, bio: "Soul and R&B from the Shoals. Sample listing until staff publish artists from FloBama OS.", websiteUrl: null },
      { ...maple, bio: "Two guitars and close harmonies. Sample listing until staff publish artists from FloBama OS.", websiteUrl: null },
    ],
    shows: [
      {
        id: "55555555-5555-4555-8555-555555555501",
        title: "The KGB Band",
        description: "Live music in the main room. Sample show until the published schedule is connected.",
        eventType: "live_music",
        startsAt: friday.toUTC().toISO()!,
        endsAt: friday.plus({ hours: 3 }).toUTC().toISO()!,
        locationLabel: "Main room",
        featured: true,
        ticketed: false,
        ticketUrl: null,
        coverCharge: null,
        artists: [kgb],
      },
      {
        id: "55555555-5555-4555-8555-555555555502",
        title: "Shoals Revival",
        description: "A full-band soul set. Sample show until the published schedule is connected.",
        eventType: "live_music",
        startsAt: saturday.toUTC().toISO()!,
        endsAt: saturday.plus({ hours: 3 }).toUTC().toISO()!,
        locationLabel: "Main room",
        featured: false,
        ticketed: false,
        ticketUrl: null,
        coverCharge: "$10",
        artists: [shoals],
      },
      {
        id: "55555555-5555-4555-8555-555555555503",
        title: "Maple Street Duo",
        description: "An acoustic set from earlier this month. Sample show until the published schedule is connected.",
        eventType: "live_music",
        startsAt: past.toUTC().toISO()!,
        endsAt: past.plus({ hours: 2 }).toUTC().toISO()!,
        locationLabel: "Main room",
        featured: false,
        ticketed: false,
        ticketUrl: null,
        coverCharge: null,
        artists: [maple],
      },
    ],
    specials: [
      { id: "77777777-7777-4777-8777-777777777701", title: "Smoked Wing Basket", subtitle: "Tonight only", category: "food", priceLabel: "$12", imageUrl: null },
      { id: "77777777-7777-4777-8777-777777777702", title: "Florence Mule", subtitle: "Ginger beer and lime", category: "drink", priceLabel: "$9", imageUrl: null },
    ],
    menu: SEEDED_MENU,
    merch: SEEDED_MERCH,
    recordings: [
      {
        id: "66666666-6666-4666-8666-666666666601",
        title: "Maple Street Duo — sample set",
        description: "Sample video until a Mux recording is published. This is not a FloBama performance.",
        playbackUrl: MUX_FIXTURE_PLAYBACK,
        thumbnailUrl: null,
        durationSeconds: 634,
        recordedAt: past.toUTC().toISO(),
        eventId: "55555555-5555-4555-8555-555555555503",
        eventTitle: "Maple Street Duo",
        artistId: maple.id,
        artistName: maple.name,
      },
    ],
  };
}

export function emptyCatalog(): CustomerCatalog {
  return { shows: [], artists: [], specials: [], menu: [], merch: [], recordings: [] };
}
