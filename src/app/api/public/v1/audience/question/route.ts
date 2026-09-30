import { z } from "zod";
import { publicAudienceJson, readAudienceGuestToken } from "@/lib/audience/http";
import { submitAudienceQuestion } from "@/lib/audience/runtime";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createServiceRoleClient();
  if (!admin) return publicAudienceJson({ error: "Audience questions are not configured." }, 503);
  const token = await readAudienceGuestToken();
  if (!token) return publicAudienceJson({ error: "Join the show first." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicAudienceJson({ error: "Send JSON." }, 400);
  }
  const parsed = z.object({ body: z.string().trim().min(3).max(280) }).safeParse(body);
  if (!parsed.success) return publicAudienceJson({ error: "Enter a question." }, 400);

  const result = await submitAudienceQuestion(admin, { guestToken: token, body: parsed.data.body });
  if (!result.ok) return publicAudienceJson({ error: result.message }, 400);
  return publicAudienceJson({ ok: true });
}
