import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import { buildDeviceManifest } from "@/lib/display-devices/manifest";
import { DISPLAY_DOWNLOAD_URL_TTL_SECONDS } from "@/lib/display-devices/types";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type AdminClient = SupabaseClient<Database>;

async function resolveDownloadSource(
  admin: AdminClient,
  venueId: string,
  assetId: string,
  fromManifest: string | null | undefined,
): Promise<{ storagePath: string | null; publicUrl: string | null }> {
  const [sceneRes, adRes] = await Promise.all([
    admin
      .from("led_wall_scenes")
      .select("storage_path, public_url")
      .eq("venue_id", venueId)
      .eq("id", assetId)
      .maybeSingle(),
    admin
      .from("screen_ads")
      .select("storage_path, public_url")
      .eq("venue_id", venueId)
      .eq("id", assetId)
      .maybeSingle(),
  ]);

  const row = sceneRes.data ?? adRes.data;
  return {
    storagePath: fromManifest || row?.storage_path || null,
    publicUrl: row?.public_url ?? null,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "Device token required." }, { status: 401 });

  const auth = await authenticateDisplayDevice(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { assetId } = await context.params;
  if (!assetId || assetId.length > 120) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const manifest = await buildDeviceManifest(auth.admin, {
    deviceId: auth.device.id,
    venueId: auth.device.venue_id,
    kind: auth.device.kind,
  });
  const asset = manifest.assets.find((entry) => entry.id === assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  if (asset.streamUrl || String(asset.mediaType || "").includes("youtube")) {
    return NextResponse.json(
      { error: "YouTube takes stream remotely and are not downloadable." },
      { status: 400 },
    );
  }

  const resolved = await resolveDownloadSource(
    auth.admin,
    auth.device.venue_id,
    assetId,
    asset.storagePath,
  );

  const expiresAt = new Date(Date.now() + DISPLAY_DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString();
  const base = {
    assetId: asset.id,
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
    mediaType: asset.mediaType,
    expiresAt,
  };

  if (resolved.storagePath) {
    const { data: signed, error: signError } = await auth.admin.storage
      .from("screen-ads")
      .createSignedUrl(resolved.storagePath, DISPLAY_DOWNLOAD_URL_TTL_SECONDS);

    if (!signError && signed?.signedUrl) {
      return NextResponse.json({ ...base, url: signed.signedUrl, signed: true });
    }

    const { data: publicData } = auth.admin.storage.from("screen-ads").getPublicUrl(resolved.storagePath);
    if (publicData?.publicUrl) {
      return NextResponse.json({ ...base, url: publicData.publicUrl, signed: false });
    }
  }

  // Last resort: scene/ad public_url (covers rows missing storage_path).
  if (resolved.publicUrl && /^https?:\/\//i.test(resolved.publicUrl)) {
    return NextResponse.json({ ...base, url: resolved.publicUrl, signed: false });
  }

  return NextResponse.json(
    { error: "Asset not found.", detail: "No storage_path or http public_url for this media." },
    { status: 404 },
  );
}
