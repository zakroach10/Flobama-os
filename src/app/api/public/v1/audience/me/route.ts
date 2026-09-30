import { publicAudienceJson, readAudienceGuestToken } from "@/lib/audience/http";
import { getAudienceGuestStateByToken } from "@/lib/audience/runtime";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) return publicAudienceJson({ error: "Audience is not configured." }, 503);
  const token = await readAudienceGuestToken();
  if (!token) return publicAudienceJson({ state: null });
  const result = await getAudienceGuestStateByToken(admin, token);
  if (!result.ok) return publicAudienceJson({ error: result.message }, 500);
  return publicAudienceJson({ state: result.state });
}
