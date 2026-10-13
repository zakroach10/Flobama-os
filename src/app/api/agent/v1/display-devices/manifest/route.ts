import { NextResponse } from "next/server";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import { buildDeviceManifest } from "@/lib/display-devices/manifest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "Device token required." }, { status: 401 });

  const auth = await authenticateDisplayDevice(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const manifest = await buildDeviceManifest(auth.admin, {
    deviceId: auth.device.id,
    venueId: auth.device.venue_id,
    kind: auth.device.kind,
  });

  const ifNoneMatch = request.headers.get("if-none-match")?.replaceAll('"', "").trim() ?? null;
  if (ifNoneMatch && ifNoneMatch === manifest.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: `"${manifest.etag}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  // Do not expose raw storage paths to devices in the HTTP body.
  const publicManifest = {
    ...manifest,
    assets: manifest.assets.map(({ storagePath: _storagePath, ...asset }) => asset),
  };

  return NextResponse.json(publicManifest, {
    headers: {
      ETag: `"${manifest.etag}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
