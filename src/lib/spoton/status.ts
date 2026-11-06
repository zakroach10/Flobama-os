import type { SupabaseClient } from "@supabase/supabase-js";
import { spotonCredentialPresence } from "@/lib/spoton/credentials";
import type { SpotOnCapabilityStatus, SpotOnSettingsRow } from "@/lib/spoton/types";
import { getPublicAppUrl } from "@/lib/env";

export function webhookUrlForOrigin(origin?: string): string {
  const base = (origin ?? getPublicAppUrl()).replace(/\/$/, "");
  return `${base}/api/integrations/spoton/webhook`;
}

export function deriveCapabilityStatuses(settings: SpotOnSettingsRow | null): {
  webhook: SpotOnCapabilityStatus;
  reporting: SpotOnCapabilityStatus;
  menu: SpotOnCapabilityStatus;
  credentials: ReturnType<typeof spotonCredentialPresence>;
} {
  const credentials = spotonCredentialPresence();
  let webhook: SpotOnCapabilityStatus = settings?.webhook_status ?? "not_configured";
  let reporting: SpotOnCapabilityStatus = settings?.reporting_status ?? "not_configured";
  let menu: SpotOnCapabilityStatus = settings?.menu_status ?? "not_configured";

  // Saving credentials alone must not produce a connected/verified state.
  if (!credentials.webhookSignatureKey || !credentials.locationId) {
    webhook = "not_configured";
  } else if (webhook === "not_configured") {
    webhook = "configured_unverified";
  }

  const hasReportingCreds =
    (settings?.api_product === "restaurant_export" && credentials.restaurantExportApiKey) ||
    (settings?.api_product === "central_api" &&
      credentials.centralClientId &&
      credentials.centralClientSecret);
  if (!credentials.locationId || !hasReportingCreds) {
    if (settings?.api_product === "none") reporting = "not_configured";
    else if (!hasReportingCreds) reporting = "not_configured";
  } else if (reporting === "not_configured") {
    reporting = "configured_unverified";
  }

  const hasMenuCreds =
    credentials.centralClientId && credentials.centralClientSecret && credentials.locationId;
  if (!hasMenuCreds) {
    menu = "not_configured";
  } else if (menu === "not_configured") {
    menu = "configured_unverified";
  }

  return { webhook, reporting, menu, credentials };
}

export async function loadSpotOnSettings(
  client: SupabaseClient,
  venueId: string,
): Promise<SpotOnSettingsRow | null> {
  const { data, error } = await client.from("spoton_settings").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SpotOnSettingsRow | null) ?? null;
}

export function formatCapabilityLabel(status: SpotOnCapabilityStatus): string {
  switch (status) {
    case "not_configured":
      return "Not configured";
    case "configured_unverified":
      return "Configured (unverified)";
    case "verified":
      return "Verified";
    case "permission_denied":
      return "Permission denied";
    case "unavailable":
      return "Unavailable";
  }
}

export function unavailableOrCents(value: number | null | undefined, available: boolean): string {
  if (!available) return "Unavailable";
  if (value == null) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}
