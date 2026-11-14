import { API_BASE_URL } from "@/src/config";
import type {
  PublicEventDetailResponse,
  PublicEventJson,
  PublicEventsResponse,
  PublicNowResponse,
} from "@/src/types";

export class PublicApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new PublicApiError("Could not reach FloBama. Check your connection and try again.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const errorMessage =
    body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : null;

  if (!response.ok) {
    throw new PublicApiError(errorMessage ?? `Request failed (${response.status}).`, response.status);
  }

  return body as T;
}

export async function fetchTonight(): Promise<PublicNowResponse> {
  return getJson<PublicNowResponse>("/api/public/v1/now");
}

export async function fetchUpcomingEvents(limit = 80): Promise<PublicEventJson[]> {
  const data = await getJson<PublicEventsResponse>(`/api/public/v1/events?limit=${limit}`);
  return data.events ?? [];
}

export async function fetchEvent(id: string): Promise<PublicEventJson> {
  const data = await getJson<PublicEventDetailResponse>(`/api/public/v1/events/${encodeURIComponent(id)}`);
  if (!data.event) {
    throw new PublicApiError("Event not found.", 404);
  }
  return data.event;
}
