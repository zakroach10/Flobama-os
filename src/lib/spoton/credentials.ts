/**
 * Server-only SpotOn credentials. Never expose via NEXT_PUBLIC_*.
 *
 * Restaurant Export API: x-api-key + location id (per-location access).
 * Central API: OAuth client credentials + optional webhook signature_key.
 * These products are independent — a working webhook does not grant reporting.
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") return undefined;
  return value.trim();
}

export type SpotOnRestaurantExportCredentials = {
  apiKey: string;
  locationId: string;
  baseUrl: string;
};

export type SpotOnCentralCredentials = {
  clientId: string;
  clientSecret: string;
  locationId: string;
  tokenUrl: string;
  apiBaseUrl: string;
  scopes: string;
};

export type SpotOnWebhookCredentials = {
  signatureKeyBase64: string;
  locationId: string;
};

export function getSpotOnRestaurantExportCredentials(): SpotOnRestaurantExportCredentials | null {
  const apiKey = readEnv("SPOTON_RESTAURANT_EXPORT_API_KEY");
  const locationId = readEnv("SPOTON_LOCATION_ID");
  if (!apiKey || !locationId) return null;
  return {
    apiKey,
    locationId,
    baseUrl: readEnv("SPOTON_RESTAURANT_EXPORT_BASE_URL") ?? "https://restaurantapi.spoton.com",
  };
}

export function getSpotOnCentralCredentials(): SpotOnCentralCredentials | null {
  const clientId = readEnv("SPOTON_CENTRAL_CLIENT_ID");
  const clientSecret = readEnv("SPOTON_CENTRAL_CLIENT_SECRET");
  const locationId = readEnv("SPOTON_LOCATION_ID");
  if (!clientId || !clientSecret || !locationId) return null;
  return {
    clientId,
    clientSecret,
    locationId,
    tokenUrl: readEnv("SPOTON_CENTRAL_TOKEN_URL") ?? "https://api.spoton.com/oauth2/v1/token",
    apiBaseUrl: readEnv("SPOTON_CENTRAL_API_BASE_URL") ?? "https://api.spoton.com",
    // Only request scopes SpotOn has granted the partner client.
    scopes:
      readEnv("SPOTON_CENTRAL_SCOPES") ??
      "reporting:orders:read menu:all:read business:all:read",
  };
}

export function getSpotOnWebhookCredentials(): SpotOnWebhookCredentials | null {
  const signatureKeyBase64 = readEnv("SPOTON_WEBHOOK_SIGNATURE_KEY");
  const locationId = readEnv("SPOTON_LOCATION_ID");
  if (!signatureKeyBase64 || !locationId) return null;
  return { signatureKeyBase64, locationId };
}

export function spotonCredentialPresence() {
  return {
    locationId: Boolean(readEnv("SPOTON_LOCATION_ID")),
    restaurantExportApiKey: Boolean(readEnv("SPOTON_RESTAURANT_EXPORT_API_KEY")),
    centralClientId: Boolean(readEnv("SPOTON_CENTRAL_CLIENT_ID")),
    centralClientSecret: Boolean(readEnv("SPOTON_CENTRAL_CLIENT_SECRET")),
    webhookSignatureKey: Boolean(readEnv("SPOTON_WEBHOOK_SIGNATURE_KEY")),
  };
}
