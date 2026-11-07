/**
 * Framework-independent public event shapes for FloBama guest surfaces.
 * Mirrors GET /api/public/v1/events and /api/public/v1/now response fields.
 * Do not import Next.js or React Native code here.
 */

export type PublicEventType =
  | "live_music"
  | "karaoke"
  | "dj"
  | "sports"
  | "private_event"
  | "other";

/** Published public event as returned by the FloBama OS public API. */
export type PublicEventJson = {
  id: string;
  name: string;
  day: string;
  date: string;
  time: string;
  display: string;
  ticketed: boolean;
  ticketUrl: string | null;
  coverCharge: string | null;
  startsAt: string;
  endsAt: string;
  eventType: PublicEventType;
  locationLabel: string | null;
  featured: boolean;
  artists: string[];
  /**
   * Optional artwork URL when the API supplies one in the future.
   * Current production public API does not include this field.
   */
  artworkUrl?: string | null;
  /** Optional public description when the API supplies one. */
  description?: string | null;
};

export type PublicEventsResponse = {
  events: PublicEventJson[];
  count: number;
  error?: string;
};

export type PublicEventDetailResponse = {
  event: PublicEventJson;
  error?: string;
};

export type PublicNowResponse = {
  today: PublicEventJson[];
  nowPlaying: PublicEventJson | null;
  next: PublicEventJson | null;
  lowerThirdVisible: boolean;
  error?: string;
};
