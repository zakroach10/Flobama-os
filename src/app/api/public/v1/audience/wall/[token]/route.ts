import { publicAudienceJson } from "@/lib/audience/http";
import { getAudienceObsFrame } from "@/lib/audience/runtime";
import { normalizeAudienceWallToken, verifyAudienceWallShareToken } from "@/lib/audience/wall-share";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await context.params;
  const token = normalizeAudienceWallToken(rawToken);
  const verified = verifyAudienceWallShareToken(token);
  if (!verified.ok) return publicAudienceJson({ error: "Unknown wall." }, 404);

  const admin = createServiceRoleClient();
  if (!admin) return publicAudienceJson({ error: "Audience wall is not configured." }, 503);
  const frame = await getAudienceObsFrame(admin, verified.venueId);
  if (!frame.ok) return publicAudienceJson({ error: frame.message }, 500);
  return publicAudienceJson({ wall: frame.wall });
}
