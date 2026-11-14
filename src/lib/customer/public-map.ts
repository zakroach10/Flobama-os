import type { EventType } from "@/lib/constants";
import { hlsFromPlaybackId, thumbnailFromPlaybackId } from "@/lib/customer/stream";
import type {
  CustomerArtist,
  CustomerMenuItem,
  CustomerMerch,
  CustomerRecording,
  CustomerShow,
  CustomerSpecial,
} from "@/lib/customer/types";

const EVENT_TYPES = new Set(["live_music", "karaoke", "dj", "sports", "private_event", "other"]);

export function publicHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function mapShow(row: {
  id: string;
  title: string;
  public_description: string | null;
  event_type: string;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  featured: boolean;
  is_ticketed: boolean;
  ticket_url: string | null;
  cover_label: string | null;
  artists: { id: string; name: string; genre: string | null; display_order: number }[];
}): CustomerShow {
  const eventType = EVENT_TYPES.has(row.event_type) ? (row.event_type as EventType) : "other";
  return {
    id: row.id,
    title: row.title,
    description: row.public_description,
    eventType,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    locationLabel: row.location_label,
    featured: row.featured,
    ticketed: row.is_ticketed,
    ticketUrl: publicHttpUrl(row.ticket_url),
    coverCharge: row.cover_label,
    artists: [...row.artists]
      .sort((a, b) => a.display_order - b.display_order)
      .map((artist) => ({ id: artist.id, name: artist.name, genre: artist.genre })),
  };
}

export function mapArtist(row: {
  id: string;
  name: string;
  genre: string | null;
  bio: string | null;
  website_url: string | null;
}): CustomerArtist {
  return {
    id: row.id,
    name: row.name,
    genre: row.genre,
    bio: row.bio,
    websiteUrl: publicHttpUrl(row.website_url),
  };
}

export function mapSpecial(row: {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  price_label: string | null;
  image_url: string | null;
}): CustomerSpecial | null {
  if (row.category !== "food" && row.category !== "drink") return null;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    priceLabel: row.price_label,
    imageUrl: publicHttpUrl(row.image_url),
  };
}

export function mapMenuItem(row: {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price_label: string;
  sort_order: number;
}): CustomerMenuItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    priceLabel: row.price_label,
    sortOrder: row.sort_order,
  };
}

export function mapMerch(row: {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  sku: string | null;
  sort_order: number;
}): CustomerMerch | null {
  if (row.currency !== "usd") return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: "usd",
    imageUrl: publicHttpUrl(row.image_url),
    sku: row.sku,
    sortOrder: row.sort_order,
  };
}

export function mapRecording(row: {
  id: string;
  title: string;
  description: string | null;
  playback_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  event_id: string | null;
  event_title: string | null;
  artist_id: string | null;
  artist_name: string | null;
}): CustomerRecording {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    playbackUrl: hlsFromPlaybackId(row.playback_id),
    thumbnailUrl: publicHttpUrl(row.thumbnail_url) ?? thumbnailFromPlaybackId(row.playback_id),
    durationSeconds: row.duration_seconds,
    recordedAt: row.recorded_at,
    eventId: row.event_id,
    eventTitle: row.event_title,
    artistId: row.artist_id,
    artistName: row.artist_name,
  };
}

const SHOW_KEYS = [
  "id",
  "title",
  "description",
  "eventType",
  "startsAt",
  "endsAt",
  "locationLabel",
  "featured",
  "ticketed",
  "ticketUrl",
  "coverCharge",
  "artists",
] as const;

export function showHasOnlyPublicKeys(show: CustomerShow): boolean {
  return Object.keys(show).every((key) => SHOW_KEYS.includes(key as (typeof SHOW_KEYS)[number]));
}
