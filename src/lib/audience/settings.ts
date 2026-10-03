import type { SupabaseClient } from "@supabase/supabase-js";
import { cornerSponsorForWall, isAudienceCornerPosition } from "@/lib/audience/engine";
import type { AudienceCornerPosition, AudienceCornerSponsor } from "@/lib/audience/types";

type Client = SupabaseClient;

const CORNER_COLUMNS =
  "brand_logo_path, brand_logo_url, corner_sponsor_enabled, corner_sponsor_name, corner_sponsor_image_path, corner_sponsor_image_url, corner_sponsor_corner";
const CONTACT_COLUMNS = `${CORNER_COLUMNS}, corner_sponsor_phone, corner_sponsor_message`;

export type AudienceVenueSettingsRow = {
  brandLogoPath: string | null;
  brandLogoUrl: string | null;
  cornerSponsorEnabled: boolean;
  cornerSponsorName: string;
  cornerSponsorImagePath: string | null;
  cornerSponsorImageUrl: string | null;
  cornerSponsorCorner: AudienceCornerPosition;
  cornerSponsorPhone: string;
  cornerSponsorMessage: string;
};

export type AudienceVenueSettingsRead = {
  row: AudienceVenueSettingsRow;
  cornerSponsor: AudienceCornerSponsor | null;
  missingCornerSponsorColumns: boolean;
  missingCornerSponsorContactColumns: boolean;
};

const EMPTY_ROW: AudienceVenueSettingsRow = {
  brandLogoPath: null,
  brandLogoUrl: null,
  cornerSponsorEnabled: false,
  cornerSponsorName: "",
  cornerSponsorImagePath: null,
  cornerSponsorImageUrl: null,
  cornerSponsorCorner: "bottom-left",
  cornerSponsorPhone: "",
  cornerSponsorMessage: "",
};

function textOrNull(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function mapRow(data: Record<string, unknown> | null): AudienceVenueSettingsRow {
  const cornerRaw = typeof data?.corner_sponsor_corner === "string" ? data.corner_sponsor_corner : "";
  return {
    brandLogoPath: textOrNull(data?.brand_logo_path),
    brandLogoUrl: textOrNull(data?.brand_logo_url),
    cornerSponsorEnabled: data?.corner_sponsor_enabled === true,
    cornerSponsorName: textOrNull(data?.corner_sponsor_name) ?? "",
    cornerSponsorImagePath: textOrNull(data?.corner_sponsor_image_path),
    cornerSponsorImageUrl: textOrNull(data?.corner_sponsor_image_url),
    cornerSponsorCorner: isAudienceCornerPosition(cornerRaw) ? cornerRaw : "bottom-left",
    cornerSponsorPhone: textOrNull(data?.corner_sponsor_phone)?.slice(0, 40) ?? "",
    cornerSponsorMessage: textOrNull(data?.corner_sponsor_message)?.slice(0, 120) ?? "",
  };
}

export async function readAudienceVenueSettings(
  client: Client,
  venueId: string,
): Promise<{ ok: true; settings: AudienceVenueSettingsRead } | { ok: false; message: string }> {
  const full = await client
    .from("audience_venue_settings" as never)
    .select(CONTACT_COLUMNS)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (full.error && /corner_sponsor_phone|corner_sponsor_message/i.test(full.error.message)) {
    const base = await client
      .from("audience_venue_settings" as never)
      .select(CORNER_COLUMNS)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (base.error && /corner_sponsor/i.test(base.error.message)) {
      return readLegacyBrandSettings(client, venueId);
    }
    if (base.error) return { ok: false, message: base.error.message };
    const row = mapRow((base.data as Record<string, unknown> | null) ?? null);
    return {
      ok: true,
      settings: {
        row,
        cornerSponsor: sponsorFromRow(row),
        missingCornerSponsorColumns: false,
        missingCornerSponsorContactColumns: true,
      },
    };
  }

  if (full.error && /corner_sponsor/i.test(full.error.message)) {
    return readLegacyBrandSettings(client, venueId);
  }

  if (full.error) return { ok: false, message: full.error.message };
  const row = mapRow((full.data as Record<string, unknown> | null) ?? null);
  return {
    ok: true,
    settings: {
      row,
      cornerSponsor: sponsorFromRow(row),
      missingCornerSponsorColumns: false,
      missingCornerSponsorContactColumns: false,
    },
  };
}

function sponsorFromRow(row: AudienceVenueSettingsRow) {
  return cornerSponsorForWall({
    enabled: row.cornerSponsorEnabled,
    name: row.cornerSponsorName,
    imageUrl: row.cornerSponsorImageUrl,
    corner: row.cornerSponsorCorner,
    phone: row.cornerSponsorPhone,
    message: row.cornerSponsorMessage,
  });
}

async function readLegacyBrandSettings(
  client: Client,
  venueId: string,
): Promise<{ ok: true; settings: AudienceVenueSettingsRead } | { ok: false; message: string }> {
  const legacy = await client
    .from("audience_venue_settings" as never)
    .select("brand_logo_path, brand_logo_url")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (legacy.error) return { ok: false, message: legacy.error.message };
  const row = mapRow((legacy.data as Record<string, unknown> | null) ?? null);
  return {
    ok: true,
    settings: {
      row,
      cornerSponsor: null,
      missingCornerSponsorColumns: true,
      missingCornerSponsorContactColumns: true,
    },
  };
}

export function emptyAudienceVenueSettings(): AudienceVenueSettingsRead {
  return {
    row: { ...EMPTY_ROW },
    cornerSponsor: null,
    missingCornerSponsorColumns: false,
    missingCornerSponsorContactColumns: false,
  };
}
