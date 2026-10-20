import { z } from "zod";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { completeYoutubeWallPlayback } from "@/lib/server-station/overrides";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sceneId: z.string().uuid(),
});

export function OPTIONS() {
  return publicOptions();
}

/**
 * Called by the LED display / local wall player when a YouTube take ends.
 * Restores normal house programming for that scene only.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicJson({ ok: false, error: "Send JSON." }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return publicJson({ ok: false, error: "Missing sceneId." }, 400);

  const admin = createServiceRoleClient();
  if (!admin) return publicJson({ ok: false, error: "Not configured." }, 503);

  const result = await completeYoutubeWallPlayback(admin, FLO_BAMA_VENUE_ID, parsed.data.sceneId);
  if (!result.ok) {
    return publicJson({ ok: false, error: result.message }, 409, PUBLIC_NO_STORE);
  }

  revalidatePath("/display/led");
  revalidatePath("/server");
  revalidatePath("/api/public/v1/screens/led");
  return publicJson({ ok: true, message: result.message }, 200, PUBLIC_NO_STORE);
}
