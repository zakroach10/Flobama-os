import { after } from "next/server";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { getPublicDisplayReloadSignal } from "@/lib/queries/display-signals";
import { getPublicLedPlayback } from "@/lib/queries/led-playlists";
import { triggerLedWallAutomationFromDisplay } from "@/lib/screens/led-wall-cron";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  // Keep schedules moving even when Vercel cron auth/env is misconfigured.
  after(() => {
    void triggerLedWallAutomationFromDisplay();
  });

  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Public listings are not configured." }, 503);
  const [{ playback, error }, signalRes] = await Promise.all([
    getPublicLedPlayback(client, FLO_BAMA_VENUE_ID),
    getPublicDisplayReloadSignal(client, FLO_BAMA_VENUE_ID),
  ]);
  if (error) return publicJson({ error }, 500);
  return publicJson(
    {
      active: playback.active,
      mode: playback.mode,
      playlist: playback.playlist,
      playlistId: playback.playlistId,
      startedAt: playback.startedAt,
      revision: playback.revision,
      reloadNonce: signalRes.signal.reloadNonce,
    },
    200,
    PUBLIC_NO_STORE,
  );
}
