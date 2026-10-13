import { NextResponse } from "next/server";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import { buildDeviceManifest } from "@/lib/display-devices/manifest";
import { DISPLAY_DOWNLOAD_URL_TTL_SECONDS } from "@/lib/display-devices/types";

export const dynamic = "force-dynamic";

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
  if (!asset?.storagePath) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + DISPLAY_DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString();

  const { data: signed, error: signError } = await auth.admin.storage
    .from("screen-ads")
    .createSignedUrl(asset.storagePath, DISPLAY_DOWNLOAD_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    // Fallback: public URL still works while bucket is public; devices should prefer signed.
    const { data: publicData } = auth.admin.storage.from("screen-ads").getPublicUrl(asset.storagePath);
    if (!publicData?.publicUrl) {
      return NextResponse.json({ error: "Could not authorize media download." }, { status: 503 });
    }
    return NextResponse.json({
      assetId: asset.id,
      sha256: asset.sha256,
      sizeBytes: asset.sizeBytes,
      mediaType: asset.mediaType,
      expiresAt,
      url: publicData.publicUrl,
      signed: false,
    });
  }

  return NextResponse.json({
    assetId: asset.id,
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
    mediaType: asset.mediaType,
    expiresAt,
    url: signed.signedUrl,
    signed: true,
  });
}
