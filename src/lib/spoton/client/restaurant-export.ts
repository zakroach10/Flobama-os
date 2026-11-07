import {
  getSpotOnRestaurantExportCredentials,
  type SpotOnRestaurantExportCredentials,
} from "@/lib/spoton/credentials";
import { SpotOnHttpError, spotonFetchJson, toRfc3339NoMillis } from "@/lib/spoton/client/http";
import {
  SPOTON_EXPORT_END_LAG_MS,
  SPOTON_EXPORT_MAX_WINDOW_MS,
} from "@/lib/spoton/types";

/**
 * SpotOn Restaurant Export API (RPOS).
 * Docs:
 * - Access: https://developers.spoton.com/restaurant/docs/api-access
 * - Orders: https://developers.spoton.com/restaurant/docs/orders-1
 * - GET https://restaurantapi.spoton.com/posexport/v1/locations/{locationId}/orders
 *
 * Auth: x-api-key header. Max window 26h. End must be ≥5 minutes in the past.
 * Prefer updatedAtStart/updatedAtEnd. Retention ~90 days.
 */

export type RestaurantExportOrder = Record<string, unknown> & {
  id: string;
  locationId?: string;
  updatedAt?: string;
  createdAt?: string;
  closedAt?: string | null;
  deleted?: boolean;
};

export function assertExportWindow(start: Date, end: Date, now = new Date()) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new Error("Invalid export window start");
  }
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid export window end");
  }
  if (end <= start) throw new Error("Export window end must be after start");
  if (end.getTime() - start.getTime() > SPOTON_EXPORT_MAX_WINDOW_MS) {
    throw new Error("Restaurant Export date range cannot exceed 26 hours");
  }
  const maxEnd = new Date(now.getTime() - SPOTON_EXPORT_END_LAG_MS);
  if (end.getTime() > maxEnd.getTime()) {
    throw new Error("Export window end must be at least 5 minutes in the past");
  }
}

export function clampExportEnd(end: Date, now = new Date()): Date {
  const maxEnd = new Date(now.getTime() - SPOTON_EXPORT_END_LAG_MS);
  return end.getTime() > maxEnd.getTime() ? maxEnd : end;
}

export async function fetchRestaurantExportOrders(input: {
  credentials?: SpotOnRestaurantExportCredentials | null;
  updatedAtStart: Date;
  updatedAtEnd: Date;
  now?: Date;
}): Promise<RestaurantExportOrder[]> {
  const credentials = input.credentials ?? getSpotOnRestaurantExportCredentials();
  if (!credentials) {
    throw new SpotOnHttpError("Restaurant Export credentials are not configured", 401, "");
  }
  const end = clampExportEnd(input.updatedAtEnd, input.now);
  assertExportWindow(input.updatedAtStart, end, input.now);

  const url = new URL(
    `${credentials.baseUrl.replace(/\/$/, "")}/posexport/v1/locations/${encodeURIComponent(credentials.locationId)}/orders`,
  );
  url.searchParams.set("updatedAtStart", toRfc3339NoMillis(input.updatedAtStart));
  url.searchParams.set("updatedAtEnd", toRfc3339NoMillis(end));

  const data = await spotonFetchJson<RestaurantExportOrder[] | { orders?: RestaurantExportOrder[] }>({
    url: url.toString(),
    headers: {
      "x-api-key": credentials.apiKey,
      Accept: "application/json",
    },
  });

  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.orders)) return data.orders;
  throw new SpotOnHttpError("Unexpected Restaurant Export orders payload", 500, JSON.stringify(data).slice(0, 200));
}

/** Read-only connection test: empty/short recent window. */
export async function testRestaurantExportConnection(
  credentials?: SpotOnRestaurantExportCredentials | null,
): Promise<{ ok: boolean; message: string; statusCode?: number }> {
  const creds = credentials ?? getSpotOnRestaurantExportCredentials();
  if (!creds) {
    return { ok: false, message: "SPOTON_RESTAURANT_EXPORT_API_KEY and SPOTON_LOCATION_ID required" };
  }
  const now = new Date();
  const end = clampExportEnd(now, now);
  const start = new Date(end.getTime() - 15 * 60 * 1000);
  try {
    const orders = await fetchRestaurantExportOrders({
      credentials: creds,
      updatedAtStart: start,
      updatedAtEnd: end,
      now,
    });
    return {
      ok: true,
      message: `Restaurant Export reachable; ${orders.length} order(s) in test window`,
    };
  } catch (error) {
    if (error instanceof SpotOnHttpError) {
      if (error.status === 403) {
        return {
          ok: false,
          statusCode: 403,
          message:
            "403 Forbidden — API key lacks access for this location. Ask SpotOn to grant privileges.",
        };
      }
      if (error.status === 401) {
        return { ok: false, statusCode: 401, message: "401 Unauthorized — check x-api-key" };
      }
      return {
        ok: false,
        statusCode: error.status,
        message: `Restaurant Export error HTTP ${error.status}`,
      };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Restaurant Export connection failed",
    };
  }
}
