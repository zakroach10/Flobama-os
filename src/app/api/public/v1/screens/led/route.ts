import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { getPublicDisplayReloadSignal } from "@/lib/queries/display-signals";
import { getPublicLedPlayback } from "@/lib/queries/led-playlists";
import {
  hostedPublicDisabledLedPayload,
  isHostedPublicPlaybackEnabled,
} from "@/lib/screens/hosted-public-playback";
import { loadLedPreloadItems, publicPreloadMedia, venueTimezone } from "@/lib/screens/led-preload-data";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Public listings are not configured." }, 503);

  const signalRes = await getPublicDisplayReloadSignal(client, FLO_BAMA_VENUE_ID);
  if (!isHostedPublicPlaybackEnabled("led", signalRes.signal)) {
    return publicJson(
      hostedPublicDisabledLedPayload(signalRes.signal.reloadNonce),
      200,
      PUBLIC_NO_STORE,
    );
  }

  const { playback, error } = await getPublicLedPlayback(client, FLO_BAMA_VENUE_ID);
  if (error) return publicJson({ error }, 500);

  let preload: ReturnType<typeof publicPreloadMedia> = [];
  const admin = createServiceRoleClient();
  if (admin) {
    try {
      const timeZone = await venueTimezone(admin, FLO_BAMA_VENUE_ID);
      const warmed = await loadLedPreloadItems(admin, FLO_BAMA_VENUE_ID, { timeZone, playback });
      preload = publicPreloadMedia(warmed.items);
    } catch {
      preload = [];
    }
  }

  return publicJson(
    {
      active: playback.active,
      mode: playback.mode,
      playlist: playback.playlist,
      playlistId: playback.playlistId,
      startedAt: playback.startedAt,
      revision: playback.revision,
      reloadNonce: signalRes.signal.reloadNonce,
      disabled: false,
      preload,
    },
    200,
    PUBLIC_NO_STORE,
  );
}
