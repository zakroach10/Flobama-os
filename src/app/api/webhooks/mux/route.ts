import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { customerFixturesEnabled } from "@/lib/customer/catalog";
import { verifyTimestampedSignature } from "@/lib/customer/signatures";
import { muxEnvFromProcess } from "@/lib/customer/stream";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MuxAssetEvent = {
  type?: string;
  data?: {
    id?: string;
    live_stream_id?: string;
    duration?: number;
    playback_ids?: { id?: string; policy?: string }[];
    created_at?: number;
  };
};

export async function POST(request: Request) {
  const env = muxEnvFromProcess();
  const raw = await request.text();
  if (!verifyTimestampedSignature({ header: request.headers.get("mux-signature"), secret: env.webhookSecret, rawBody: raw })) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (customerFixturesEnabled()) {
    return Response.json({ received: true, stored: false });
  }
  const event = JSON.parse(raw) as MuxAssetEvent;
  if (event.type !== "video.asset.ready") return Response.json({ received: true });
  const asset = event.data;
  if (!asset?.id || !asset.live_stream_id || asset.live_stream_id !== env.liveStreamId) {
    return Response.json({ received: true });
  }
  const playbackId = asset.playback_ids?.find((row) => row.policy === "public")?.id || asset.playback_ids?.[0]?.id;
  if (!playbackId) return Response.json({ received: true });
  const client = createServiceRoleClient();
  if (!client) return Response.json({ error: "Order storage is not configured." }, { status: 503 });
  const recordedAt = asset.created_at ? new Date(asset.created_at * 1000).toISOString() : new Date().toISOString();
  const { error } = await client.from("customer_recordings").insert({
    venue_id: FLO_BAMA_VENUE_ID,
    provider: "mux",
    provider_asset_id: asset.id,
    playback_id: playbackId,
    title: "Live recording",
    duration_seconds: asset.duration ? Math.round(asset.duration) : null,
    recorded_at: recordedAt,
    published: false,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ received: true, stored: !error });
}
