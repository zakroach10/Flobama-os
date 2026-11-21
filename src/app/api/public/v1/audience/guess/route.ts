import { z } from "zod";
import { publicAudienceJson, readAudienceGuestToken } from "@/lib/audience/http";
import { submitAudienceGuess } from "@/lib/audience/runtime";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createServiceRoleClient();
  if (!admin) return publicAudienceJson({ error: "Audience guesses are not configured." }, 503);
  const token = await readAudienceGuestToken();
  if (!token) return publicAudienceJson({ error: "Join the show first." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return publicAudienceJson({ error: "Send JSON." }, 400);
  }
  const parsed = z.object({ answer: z.string().trim().min(1).max(160) }).safeParse(body);
  if (!parsed.success) return publicAudienceJson({ error: "Enter a guess." }, 400);

  const result = await submitAudienceGuess(admin, { guestToken: token, answer: parsed.data.answer });
  if (!result.ok) return publicAudienceJson({ error: result.message }, 400);
  return publicAudienceJson({
    state: result.state,
    correct: result.correct,
    won: result.won,
    late: result.late,
  });
}
