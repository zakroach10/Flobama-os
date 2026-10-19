import { NextResponse } from "next/server";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import { buildDeviceManifest } from "@/lib/display-devices/manifest";
import { displayDeviceHeartbeatSchema } from "@/lib/validation/schemas";
import type { Json } from "@/lib/database.types";
import { resolveDesiredObsScene } from "@/lib/screens/led-wall";
import { getPublicLedPlayback, resolvePlaylistActiveScene } from "@/lib/queries/led-playlists";
import { listPendingPerformanceCommands } from "@/lib/performance/commands";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "Device token required." }, { status: 401 });

  const auth = await authenticateDisplayDevice(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = displayDeviceHeartbeatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the heartbeat payload." }, { status: 400 });

  const now = new Date().toISOString();
  const { error: deviceError } = await auth.admin
    .from("display_devices")
    .update({
      last_seen_at: now,
      app_version: parsed.data.appVersion?.trim() || undefined,
    })
    .eq("id", auth.device.id);
  if (deviceError) return NextResponse.json({ error: "Could not update device." }, { status: 500 });

  if (auth.device.kind === "led_runner") {
    const scenes = parsed.data.obs?.scenes ?? [];
    const { error: agentMirrorError } = await auth.admin.from("led_wall_agent_status").upsert(
      {
        venue_id: auth.device.venue_id,
        last_seen_at: now,
        obs_connected: parsed.data.obs?.connected ?? false,
        program_scene: parsed.data.obs?.programScene ?? null,
        obs_scenes: scenes,
      },
      { onConflict: "venue_id" },
    );
    if (agentMirrorError) {
      console.error("local runner agent status mirror failed", agentMirrorError.message);
    }
  }

  const { data: priorStatus } = await auth.admin
    .from("display_device_status")
    .select("safe_refresh_requested_at")
    .eq("device_id", auth.device.id)
    .maybeSingle();

  const { error: statusError } = await auth.admin.from("display_device_status").upsert(
    {
      device_id: auth.device.id,
      venue_id: auth.device.venue_id,
      obs_connected: parsed.data.obs?.connected ?? null,
      program_scene: parsed.data.obs?.programScene ?? null,
      cache_bytes: parsed.data.cache?.bytesUsed ?? null,
      cache_limit_bytes: parsed.data.cache?.bytesLimit ?? null,
      assets_ready: parsed.data.cache?.assetsReady ?? null,
      assets_pending: parsed.data.cache?.assetsPending ?? null,
      manifest_revision: parsed.data.manifestRevision ?? null,
      current_asset_id: parsed.data.currentAssetId ?? null,
      playback_state: parsed.data.playbackState ?? null,
      download_progress: (parsed.data.downloads ?? {}) as Json,
      disk_free_bytes: parsed.data.diskFreeBytes ?? null,
      last_error: parsed.data.lastError ?? null,
      reported_at: now,
    },
    { onConflict: "device_id" },
  );
  if (statusError) return NextResponse.json({ error: "Could not record device status." }, { status: 500 });

  const manifest = await buildDeviceManifest(auth.admin, {
    deviceId: auth.device.id,
    venueId: auth.device.venue_id,
    kind: auth.device.kind,
  });

  const clientRevision = parsed.data.manifestRevision ?? null;
  const manifestChanged = clientRevision !== manifest.revision;

  let desiredObsScene: string | null = null;
  if (auth.device.kind === "led_runner") {
    const [runtimeRes, settingsRes, playbackRes] = await Promise.all([
      auth.admin
        .from("led_wall_runtime")
        .select("active_scene_id, active_playlist_id, activated_at")
        .eq("venue_id", auth.device.venue_id)
        .maybeSingle(),
      auth.admin
        .from("led_wall_settings")
        .select("media_obs_scene_name")
        .eq("venue_id", auth.device.venue_id)
        .maybeSingle(),
      getPublicLedPlayback(auth.admin, auth.device.venue_id),
    ]);

    let activeScene: {
      id: string;
      kind: "obs" | "media" | "trivia" | "audience";
      enabled: boolean;
      obsSceneName: string | null;
    } | null = null;

    if (playbackRes.playback.mode === "playlist") {
      activeScene = resolvePlaylistActiveScene(playbackRes.playback);
    } else if (runtimeRes.data?.active_scene_id) {
      const { data: scene } = await auth.admin
        .from("led_wall_scenes")
        .select("id, kind, enabled, obs_scene_name")
        .eq("id", runtimeRes.data.active_scene_id)
        .eq("venue_id", auth.device.venue_id)
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

    desiredObsScene = resolveDesiredObsScene({
      activeScene,
      mediaObsSceneName: settingsRes.data?.media_obs_scene_name ?? null,
    });
  }

  const safeRefresh = Boolean(priorStatus?.safe_refresh_requested_at);
  if (safeRefresh) {
    await auth.admin
      .from("display_device_status")
      .update({ safe_refresh_requested_at: null })
      .eq("device_id", auth.device.id);
  }

  // Mirror authoritative performance playback from the runner (when provided).
  if (parsed.data.performance && auth.device.kind === "led_runner") {
    const perf = parsed.data.performance;
    await auth.admin.from("performance_playback_state").upsert(
      {
        device_id: auth.device.id,
        venue_id: auth.device.venue_id,
        mode: perf.mode === "performance" ? "performance" : "normal",
        revision: Number(perf.revision) || 1,
        audio_muted: perf.audioMuted !== false,
        now_playing_queue_item_id: perf.nowPlaying?.queueItemId ?? null,
        now_playing_recording_id: perf.nowPlaying?.recordingId ?? null,
        now_playing_title: perf.nowPlaying?.displayTitle ?? null,
        position_seconds: perf.nowPlaying?.positionSeconds ?? null,
        duration_seconds: perf.nowPlaying?.durationSeconds ?? null,
        paused: Boolean(perf.nowPlaying?.paused),
        status: perf.nowPlaying?.status ?? null,
        last_error: perf.lastError ?? null,
        reported_at: now,
      },
      { onConflict: "device_id" },
    );
    if (perf.recordingsRoot || perf.catalogCount != null || perf.lastScanAt) {
      await auth.admin.from("performance_library_settings").upsert(
        {
          venue_id: auth.device.venue_id,
          device_id: auth.device.id,
          recordings_root: perf.recordingsRoot ?? undefined,
          last_scan_at: perf.lastScanAt ?? undefined,
          catalog_count: perf.catalogCount ?? undefined,
        },
        { onConflict: "venue_id" },
      );
    }
  }

  let performanceCommands: Array<{
    id: string;
    kind: string;
    payload: Json;
    expiresAt: string;
  }> = [];
  if (auth.device.kind === "led_runner") {
    const pending = await listPendingPerformanceCommands(auth.admin, auth.device.id, new Date(now));
    performanceCommands = pending.commands;
  }

  // Priority: performance playback on the runner suppresses routine OBS scene chasing
  // when the runner reports performance mode (handled client-side). Server still sends desiredObsScene.
  return NextResponse.json({
    ok: true,
    serverTime: now,
    manifestRevision: manifest.revision,
    manifestChanged,
    commands: {
      safeRefresh,
      desiredObsScene,
      performanceCommands,
    },
  });
}
