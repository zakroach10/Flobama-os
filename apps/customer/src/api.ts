import { apiBase } from "./theme";

export type ArtistRef = { id: string; name: string; genre: string | null };

export type Show = {
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
  artists: ArtistRef[];
};

export type Artist = ArtistRef & { bio: string | null; websiteUrl: string | null };

export type Special = {
  id: string;
  title: string;
  subtitle: string | null;
  category: "food" | "drink";
  priceLabel: string | null;
  imageUrl: string | null;
};

export type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  priceLabel: string;
  sortOrder: number;
};

export type Merch = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: "usd";
  imageUrl: string | null;
  sku: string | null;
};

export type Recording = {
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

export type LiveState = {
  provider: "mux";
  live: boolean;
  playbackUrl: string | null;
  preview: boolean;
  message: string;
};

export type PublicOrder = {
  id: string;
  status: string;
  email: string;
  totalCents: number;
  currency: "usd";
  items: { productId: string; name: string; quantity: number; unitPriceCents: number }[];
  createdAt: string;
  checkoutUrl: string;
  mode: "test" | "stripe";
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "FloBama is unavailable right now.");
  }
  return body;
}

export const api = {
  home: () =>
    request<{ sample: boolean; live: LiveState; tonight: Show | null; upcoming: Show[]; specials: Special[] }>("/api/public/v1/customer/home"),
  shows: (past = false) => request<{ sample: boolean; shows: Show[] }>(`/api/public/v1/customer/shows${past ? "?past=1" : ""}`),
  show: (id: string) => request<{ sample: boolean; show: Show; recordings: Recording[] }>(`/api/public/v1/customer/shows/${id}`),
  artist: (id: string) =>
    request<{ sample: boolean; artist: Artist; shows: Show[]; recordings: Recording[] }>(`/api/public/v1/customer/artists/${id}`),
  menu: () => request<{ sample: boolean; specials: Special[]; items: MenuItem[] }>("/api/public/v1/customer/menu"),
  merch: () => request<{ sample: boolean; products: Merch[] }>("/api/public/v1/customer/merch"),
  recordings: () => request<{ sample: boolean; recordings: Recording[] }>("/api/public/v1/customer/recordings"),
  recording: (id: string) => request<{ sample: boolean; recording: Recording }>(`/api/public/v1/customer/recordings/${id}`),
  checkout: (body: { email: string; items: { productId: string; quantity: number }[]; idempotencyKey: string }) =>
    request<{ mode: "test" | "stripe"; checkoutUrl: string; accessToken: string; order: PublicOrder }>(
      "/api/public/v1/customer/checkout",
      { method: "POST", body: JSON.stringify(body) },
    ),
  complete: (body: { orderId: string; token: string; sessionId?: string }) =>
    request<{ order: PublicOrder }>("/api/public/v1/customer/checkout/complete", { method: "POST", body: JSON.stringify(body) }),
  order: (id: string, token: string) =>
    request<{ order: PublicOrder }>(`/api/public/v1/customer/orders/${id}?token=${encodeURIComponent(token)}`),
};
