import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { isMissingPreloadRelation } from "@/lib/screens/led-preload-data";
import type { PreloadReportState } from "@/lib/screens/led-preload";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATES = new Set<PreloadReportState>(["loading", "ready", "error"]);

export function OPTIONS() {
  return publicOptions();
}

export async function POST(request: Request) {
  const admin = createServiceRoleClient();
  if (!admin) return publicJson({ error: "Preload reports are not configured." }, 503, PUBLIC_NO_STORE);

  const body = (await request.json().catch(() => null)) as {
    clientKey?: unknown;
    reports?: unknown;
  } | null;
  const clientKey = typeof body?.clientKey === "string" ? body.clientKey.trim() : "";
  if (clientKey.length < 8 || clientKey.length > 80) {
    return publicJson({ error: "Client key is invalid." }, 400, PUBLIC_NO_STORE);
  }
  if (!Array.isArray(body?.reports) || body.reports.length > 12) {
    return publicJson({ error: "Reports are invalid." }, 400, PUBLIC_NO_STORE);
  }

  const rows: Array<{
    venue_id: string;
    scene_id: string;
    client_key: string;
    state: PreloadReportState;
    message: string | null;
    updated_at: string;
  }> = [];
  for (const entry of body.reports) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { sceneId?: unknown; state?: unknown; message?: unknown };
    const sceneId = typeof record.sceneId === "string" ? record.sceneId : "";
    const state = typeof record.state === "string" ? record.state : "";
    if (!/^[0-9a-f-]{36}$/i.test(sceneId) || !STATES.has(state as PreloadReportState)) continue;
    const message = typeof record.message === "string" ? record.message.slice(0, 180) : null;
    rows.push({
      venue_id: FLO_BAMA_VENUE_ID,
      scene_id: sceneId,
      client_key: clientKey,
      state: state as PreloadReportState,
      message,
      updated_at: new Date().toISOString(),
    });
  }
  if (rows.length === 0) return publicJson({ stored: false }, 200, PUBLIC_NO_STORE);

  const sceneIds = [...new Set(rows.map((row) => row.scene_id))];
  const { data: scenes, error: sceneError } = await admin
    .from("led_wall_scenes")
    .select("id, media_kind, enabled, public_url")
    .eq("venue_id", FLO_BAMA_VENUE_ID)
    .in("id", sceneIds);
  if (sceneError) return publicJson({ error: "Could not store preload status." }, 500, PUBLIC_NO_STORE);
  const allowed = new Set(
    ((scenes ?? []) as Array<{ id: string; media_kind: string | null; enabled: boolean; public_url: string | null }>)
      .filter(
        (scene) =>
          scene.enabled &&
          (scene.media_kind === "image" || scene.media_kind === "video") &&
          Boolean(scene.public_url?.trim()),
      )
      .map((scene) => scene.id),
  );
  const accepted = rows.filter((row) => allowed.has(row.scene_id));
  if (accepted.length === 0) return publicJson({ stored: false }, 200, PUBLIC_NO_STORE);

  const { error } = await admin.from("led_wall_preload_reports" as never).upsert(accepted as never, {
    onConflict: "venue_id,scene_id,client_key",
  });
  if (error) {
    if (isMissingPreloadRelation(error.message)) return publicJson({ stored: false }, 200, PUBLIC_NO_STORE);
    return publicJson({ error: "Could not store preload status." }, 500, PUBLIC_NO_STORE);
  }
  return publicJson({ stored: true }, 200, PUBLIC_NO_STORE);
}
