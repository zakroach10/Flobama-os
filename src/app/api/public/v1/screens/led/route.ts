import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { applyLedShowtimeHandoff, getPublicLedMedia } from "@/lib/queries/led-wall";
import { isMissingLedWallRelation, toPublicLedMedia } from "@/lib/screens/led-wall";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const admin = createServiceRoleClient();
  if (admin) {
    const playback = await applyLedShowtimeHandoff(admin, FLO_BAMA_VENUE_ID);
    if (playback.error) {
      if (playback.missingTable || isMissingLedWallRelation(playback.error)) {
        return publicJson({ active: null }, 200, PUBLIC_NO_STORE);
      }
      return publicJson({ error: playback.error }, 500);
    }
    const scene = playback.scene;
    const media =
      scene && scene.kind === "media" && scene.enabled
        ? toPublicLedMedia({
            scene_id: scene.id,
            title: scene.title,
            public_url: scene.public_url,
            media_kind: scene.media_kind,
          })
        : null;
    return publicJson({ active: media }, 200, PUBLIC_NO_STORE);
  }

  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Public listings are not configured." }, 503);
  const { media, error } = await getPublicLedMedia(client, FLO_BAMA_VENUE_ID);
  if (error) return publicJson({ error }, 500);
  return publicJson({ active: media }, 200, PUBLIC_NO_STORE);
}
