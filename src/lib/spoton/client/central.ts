import {
  getSpotOnCentralCredentials,
  type SpotOnCentralCredentials,
} from "@/lib/spoton/credentials";
import { SpotOnHttpError, spotonFetchJson } from "@/lib/spoton/client/http";

/**
 * SpotOn Central API (OAuth client_credentials).
 * Docs:
 * - OAuth: https://developers.spoton.com/central-api/docs/spoton-oauth-integration-guide
 * - Reporting orders: GET https://api.spoton.com/reporting/v1/locations/{location_id}/orders
 *   scope reporting:orders:read
 * - Menus: GET https://api.spoton.com/menus/v1/... scope menu:all:read
 *
 * Service tokens expire in 24h; regenerate (no refresh token).
 */

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
  scope: string;
};

let tokenCache: TokenCache | null = null;

export async function getCentralServiceToken(
  credentials?: SpotOnCentralCredentials | null,
): Promise<{ accessToken: string; scope: string }> {
  const creds = credentials ?? getSpotOnCentralCredentials();
  if (!creds) throw new SpotOnHttpError("Central API credentials are not configured", 401, "");

  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return { accessToken: tokenCache.accessToken, scope: tokenCache.scope };
  }

  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: creds.scopes,
  });

  const token = await spotonFetchJson<{
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  }>({
    url: creds.tokenUrl,
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    retries: 2,
  });

  if (!token.access_token) {
    throw new SpotOnHttpError("Central API token response missing access_token", 500, JSON.stringify(token));
  }

  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 86_400;
  tokenCache = {
    accessToken: token.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
    scope: token.scope ?? creds.scopes,
  };
  return { accessToken: tokenCache.accessToken, scope: tokenCache.scope };
}

/** Test helper — clear cached token between tests. */
export function clearCentralTokenCache() {
  tokenCache = null;
}

export type CentralOrder = Record<string, unknown> & {
  id: string;
  location_id?: string;
  last_updated_at?: string;
  created_at?: string;
  closed_at?: string | null;
};

export async function fetchCentralOrders(input: {
  credentials?: SpotOnCentralCredentials | null;
  lastUpdatedFrom?: Date;
  lastUpdatedTo?: Date;
  fromTime?: Date;
  toTime?: Date;
  fiscalDateFrom?: string;
  fiscalDateTo?: string;
  page?: number;
  perPage?: number;
}): Promise<{ orders: CentralOrder[]; pagination: Record<string, unknown> | null }> {
  const creds = input.credentials ?? getSpotOnCentralCredentials();
  if (!creds) throw new SpotOnHttpError("Central API credentials are not configured", 401, "");
  const { accessToken } = await getCentralServiceToken(creds);

  const url = new URL(
    `${creds.apiBaseUrl.replace(/\/$/, "")}/reporting/v1/locations/${encodeURIComponent(creds.locationId)}/orders`,
  );
  if (input.lastUpdatedFrom) url.searchParams.set("last_updated_from", input.lastUpdatedFrom.toISOString());
  if (input.lastUpdatedTo) url.searchParams.set("last_updated_to", input.lastUpdatedTo.toISOString());
  if (input.fromTime) url.searchParams.set("from_time", input.fromTime.toISOString());
  if (input.toTime) url.searchParams.set("to_time", input.toTime.toISOString());
  if (input.fiscalDateFrom) url.searchParams.set("fiscal_date_from", input.fiscalDateFrom);
  if (input.fiscalDateTo) url.searchParams.set("fiscal_date_to", input.fiscalDateTo);
  url.searchParams.set("page", String(input.page ?? 1));
  url.searchParams.set("per_page", String(Math.min(1000, input.perPage ?? 100)));

  const data = await spotonFetchJson<{
    orders?: CentralOrder[];
    pagination?: Record<string, unknown>;
  }>({
    url: url.toString(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  return {
    orders: Array.isArray(data.orders) ? data.orders : [],
    pagination: data.pagination ?? null,
  };
}

export async function fetchAllCentralOrders(input: {
  credentials?: SpotOnCentralCredentials | null;
  lastUpdatedFrom?: Date;
  lastUpdatedTo?: Date;
  fromTime?: Date;
  toTime?: Date;
  fiscalDateFrom?: string;
  fiscalDateTo?: string;
}): Promise<CentralOrder[]> {
  const all: CentralOrder[] = [];
  let page = 1;
  for (;;) {
    const { orders, pagination } = await fetchCentralOrders({ ...input, page, perPage: 100 });
    all.push(...orders);
    const totalPages =
      pagination && typeof pagination.total_pages === "number"
        ? pagination.total_pages
        : orders.length < 100
          ? page
          : page + 1;
    if (page >= totalPages || orders.length === 0) break;
    page += 1;
    if (page > 500) break;
  }
  return all;
}

export async function fetchCentralMenus(input?: {
  credentials?: SpotOnCentralCredentials | null;
}): Promise<unknown> {
  const creds = input?.credentials ?? getSpotOnCentralCredentials();
  if (!creds) throw new SpotOnHttpError("Central API credentials are not configured", 401, "");
  const { accessToken } = await getCentralServiceToken(creds);
  const url = `${creds.apiBaseUrl.replace(/\/$/, "")}/menus/v1/locations/${encodeURIComponent(creds.locationId)}/menus`;
  return spotonFetchJson({
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

export async function fetchCentralMenuItems(input: {
  menuId: string;
  credentials?: SpotOnCentralCredentials | null;
  page?: number;
}): Promise<unknown> {
  const creds = input.credentials ?? getSpotOnCentralCredentials();
  if (!creds) throw new SpotOnHttpError("Central API credentials are not configured", 401, "");
  const { accessToken } = await getCentralServiceToken(creds);
  const url = new URL(
    `${creds.apiBaseUrl.replace(/\/$/, "")}/menus/v1/locations/${encodeURIComponent(creds.locationId)}/menus/${encodeURIComponent(input.menuId)}/items`,
  );
  url.searchParams.set("page", String(input.page ?? 1));
  return spotonFetchJson({
    url: url.toString(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

export async function testCentralConnection(
  credentials?: SpotOnCentralCredentials | null,
): Promise<{ ok: boolean; message: string; statusCode?: number; reporting: boolean; menu: boolean }> {
  const creds = credentials ?? getSpotOnCentralCredentials();
  if (!creds) {
    return {
      ok: false,
      message: "SPOTON_CENTRAL_CLIENT_ID, SPOTON_CENTRAL_CLIENT_SECRET, and SPOTON_LOCATION_ID required",
      reporting: false,
      menu: false,
    };
  }
  try {
    await getCentralServiceToken(creds);
  } catch (error) {
    if (error instanceof SpotOnHttpError) {
      return {
        ok: false,
        statusCode: error.status,
        message: `Central OAuth failed HTTP ${error.status}`,
        reporting: false,
        menu: false,
      };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Central OAuth failed",
      reporting: false,
      menu: false,
    };
  }

  let reporting = false;
  let menu = false;
  let message = "Central OAuth token acquired";

  try {
    const now = new Date();
    await fetchCentralOrders({
      credentials: creds,
      lastUpdatedFrom: new Date(now.getTime() - 60 * 60 * 1000),
      lastUpdatedTo: now,
      page: 1,
      perPage: 1,
    });
    reporting = true;
  } catch (error) {
    if (error instanceof SpotOnHttpError && error.status === 403) {
      message += "; reporting:permission denied";
    } else {
      message += `; reporting unavailable (${error instanceof Error ? error.message : "error"})`;
    }
  }

  try {
    await fetchCentralMenus({ credentials: creds });
    menu = true;
  } catch (error) {
    if (error instanceof SpotOnHttpError && error.status === 403) {
      message += "; menu:permission denied";
    } else {
      message += `; menu unavailable (${error instanceof Error ? error.message : "error"})`;
    }
  }

  return {
    ok: reporting || menu,
    message,
    reporting,
    menu,
  };
}
