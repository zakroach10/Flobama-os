import { z } from "zod";
import { getOrCreateAudienceGuestToken, publicAudienceJson } from "@/lib/audience/http";
import { joinAudienceSession } from "@/lib/audience/runtime";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createServiceRoleClient();
  if (!admin) return publicAudienceJson({ error: "Audience join is not configured." }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicAudienceJson({ error: "Send JSON." }, 400);
  }
  const parsed = z
    .object({
      code: z.string().trim().min(4).max(8),
      displayName: z.string().trim().min(1).max(24),
    })
    .safeParse(body);
  if (!parsed.success) {
    return publicAudienceJson({ error: parsed.error.issues[0]?.message ?? "Check fields." }, 400);
  }

  const token = await getOrCreateAudienceGuestToken();
  const result = await joinAudienceSession(admin, {
    joinCode: parsed.data.code,
    displayName: parsed.data.displayName,
    guestToken: token,
  });
  if (!result.ok) return publicAudienceJson({ error: result.message }, 400);
  return publicAudienceJson({ state: result.state });
}
