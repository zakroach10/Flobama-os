import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
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
import { getPublicLedPlayback, resolvePlaylistActiveScene } from "@/lib/queries/led-playlists";

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

  const [{ data: runtime }, { data: settings }, playbackRes] = await Promise.all([
    admin
      .from("led_wall_runtime")
      .select("active_scene_id, active_playlist_id, activated_at")
      .eq("venue_id", secret.venue_id)
      .maybeSingle(),
    admin.from("led_wall_settings").select("media_obs_scene_name").eq("venue_id", secret.venue_id).maybeSingle(),
    getPublicLedPlayback(admin, secret.venue_id),
  ]);

  let activeScene: {
    id: string;
    kind: "obs" | "media" | "trivia";
    enabled: boolean;
    obsSceneName: string | null;
  } | null = null;

  if (playbackRes.playback.mode === "playlist") {
    const current = resolvePlaylistActiveScene(playbackRes.playback);
    if (current) {
      activeScene = {
        id: current.id,
        kind: current.kind,
        enabled: current.enabled,
        obsSceneName: current.obsSceneName,
      };
    } else if (playbackRes.playback.playlist.some((item) => item.kind === "media")) {
      activeScene = {
        id: "playlist-media",
        kind: "media",
        enabled: true,
        obsSceneName: null,
      };
    }
  } else if (runtime?.active_scene_id) {
    const { data: scene } = await admin
      .from("led_wall_scenes")
      .select("id, kind, enabled, obs_scene_name")
      .eq("id", runtime.active_scene_id)
      .eq("venue_id", secret.venue_id)
      .maybeSingle();
    if (scene) {
      activeScene = {
        id: scene.id,
        kind: scene.kind,
        enabled: scene.enabled,
        obsSceneName: scene.obs_scene_name,
      };
    }
  }

  const desiredObsScene = resolveDesiredObsScene({
    activeScene,
    mediaObsSceneName: settings?.media_obs_scene_name ?? null,
  });

  return NextResponse.json({
    desiredObsScene,
    activeSceneId: activeScene?.enabled ? activeScene.id : null,
    activePlaylistId: runtime?.active_playlist_id ?? null,
    revision: playbackRes.playback.revision || runtime?.activated_at || null,
  });
}
