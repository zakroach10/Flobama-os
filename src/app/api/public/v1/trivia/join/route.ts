import { publicOptions } from "@/lib/public/http";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { normalizeDisplayName } from "@/lib/trivia/engine";
import { getOrCreateTriviaPlayerToken, publicTriviaJson } from "@/lib/trivia/http";
import { joinTriviaSession } from "@/lib/trivia/runtime";
import { triviaJoinSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function POST(request: Request) {
  const parsed = triviaJoinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return publicTriviaJson({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid join." }, 400);
  }

  const admin = createServiceRoleClient();
  if (!admin) return publicTriviaJson({ ok: false, error: "Trivia is not configured." }, 503);

  const token = await getOrCreateTriviaPlayerToken();
  const result = await joinTriviaSession(admin, {
    joinCode: parsed.data.joinCode,
    displayName: normalizeDisplayName(parsed.data.displayName),
    playerToken: token,
  });

  if (!result.ok) return publicTriviaJson({ ok: false, error: result.message }, 409);
  return publicTriviaJson({
    ok: true,
    playerId: result.playerId,
    displayName: result.displayName,
    score: result.score,
    sessionId: result.sessionId,
    joinCode: result.joinCode,
  });
}
