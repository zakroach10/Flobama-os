import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { applyLedShowtimeHandoff } from "@/lib/queries/led-wall";
import {
  blankToNull,
  hashLedAgentToken,
  isMissingLedWallRelation,
  ledAgentTokensMatch,
  parseReportedObsScenes,
  resolveDesiredObsScene,
} from "@/lib/screens/led-wall";
import { LED_WALL_SQL } from "@/lib/constants";
import { ledWallSyncSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

function readBearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  const token = readBearer(request);
  if (!token) return NextResponse.json({ error: "Booth token required." }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Booth sync is not configured." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = ledWallSyncSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the sync payload." }, { status: 400 });

  const tokenHash = hashLedAgentToken(token);
  const { data: secret, error: secretError } = await admin
    .from("led_wall_agent_secrets")
    .select("venue_id, token_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (secretError) {
    const message = isMissingLedWallRelation(secretError.message)
      ? `Apply ${LED_WALL_SQL} before starting the booth client.`
      : "Could not check the booth token.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (!secret || !ledAgentTokensMatch(secret.token_hash, token)) {
    return NextResponse.json({ error: "Booth token was not recognized." }, { status: 401 });
  }

  const scenes = parseReportedObsScenes(parsed.data.scenes);
  const programScene = blankToNull(parsed.data.programScene);
  const seenAt = new Date().toISOString();
  const { error: statusError } = await admin.from("led_wall_agent_status").upsert(
    {
      venue_id: secret.venue_id,
      last_seen_at: seenAt,
      obs_connected: parsed.data.obsConnected,
      program_scene: programScene,
      obs_scenes: scenes,
    },
    { onConflict: "venue_id" },
  );
  if (statusError) return NextResponse.json({ error: "Could not record booth status." }, { status: 500 });

  const [{ data: settings }, playback] = await Promise.all([
    admin.from("led_wall_settings").select("media_obs_scene_name").eq("venue_id", secret.venue_id).maybeSingle(),
    applyLedShowtimeHandoff(admin, secret.venue_id),
  ]);
  if (playback.error) {
    const message = playback.missingTable
      ? `Apply ${LED_WALL_SQL} before starting the booth client.`
      : "Could not resolve the LED wall scene.";
    return NextResponse.json({ error: message }, { status: playback.missingTable ? 503 : 500 });
  }

  const scene = playback.scene;
  const desiredObsScene = resolveDesiredObsScene({
    activeScene: scene
      ? {
          id: scene.id,
          kind: scene.kind,
          enabled: scene.enabled,
          obsSceneName: scene.obs_scene_name,
        }
      : null,
    mediaObsSceneName: settings?.media_obs_scene_name ?? null,
  });

  return NextResponse.json({
    desiredObsScene,
    activeSceneId: playback.activeSceneId,
    revision: scene?.updated_at ?? null,
  });
}
