export const CUSTOMER_ORDER_STATUSES = ["pending", "paid", "fulfilled", "cancelled", "refunded"] as const;
export type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];

export type CustomerArtistRef = {
  id: string;
  name: string;
  genre: string | null;
};

export type CustomerArtist = CustomerArtistRef & {
  bio: string | null;
  websiteUrl: string | null;
};

export type CustomerShow = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string | null;
  featured: boolean;
  ticketed: boolean;
  ticketUrl: string | null;
  coverCharge: string | null;
  artists: CustomerArtistRef[];
};

export type CustomerSpecial = {
  id: string;
  title: string;
  subtitle: string | null;
  category: "food" | "drink";
  priceLabel: string | null;
  imageUrl: string | null;
};

export type CustomerMenuItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  priceLabel: string;
  sortOrder: number;
};

export type CustomerMerch = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: "usd";
  imageUrl: string | null;
  sku: string | null;
  sortOrder: number;
};

export type CustomerRecording = {
  id: string;
  title: string;
  description: string | null;
  playbackUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  recordedAt: string | null;
  eventId: string | null;
  eventTitle: string | null;
  artistId: string | null;
  artistName: string | null;
};

export type CustomerCatalog = {
  shows: CustomerShow[];
  artists: CustomerArtist[];
  specials: CustomerSpecial[];
  menu: CustomerMenuItem[];
  merch: CustomerMerch[];
  recordings: CustomerRecording[];
};

export type LiveState = {
  provider: "mux";
  live: boolean;
  playbackUrl: string | null;
  preview: boolean;
  message: string;
};

export type PricedLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type StoredOrder = {
  id: string;
  venueId: string;
  status: CustomerOrderStatus;
  email: string;
  name: string | null;
  totalCents: number;
  currency: "usd";
  accessToken: string;
  checkoutMode: "test" | "stripe";
  checkoutUrl: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  idempotencyKey: string | null;
  items: PricedLine[];
  createdAt: string;
};

export type PublicOrder = {
  id: string;
  status: CustomerOrderStatus;
  email: string;
  totalCents: number;
  currency: "usd";
  items: PricedLine[];
  createdAt: string;
  checkoutUrl: string;
  mode: "test" | "stripe";
};
