import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { publicAudienceJson } from "@/lib/audience/http";
import { getAudienceWallState } from "@/lib/audience/runtime";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) return publicAudienceJson({ error: "Audience wall is not configured." }, 503);
  const result = await getAudienceWallState(admin, FLO_BAMA_VENUE_ID);
  if (!result.ok) return publicAudienceJson({ error: result.message }, 500);
  return publicAudienceJson({ wall: result.wall });
}
