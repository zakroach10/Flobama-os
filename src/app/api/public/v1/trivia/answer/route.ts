import { publicOptions } from "@/lib/public/http";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readTriviaPlayerToken, publicTriviaJson } from "@/lib/trivia/http";
import { submitTriviaAnswer } from "@/lib/trivia/runtime";
import { triviaAnswerSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function POST(request: Request) {
  const parsed = triviaAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return publicTriviaJson({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answer." }, 400);
  }

  const token = await readTriviaPlayerToken();
  if (!token) return publicTriviaJson({ ok: false, error: "Join trivia first." }, 401);

  const admin = createServiceRoleClient();
  if (!admin) return publicTriviaJson({ ok: false, error: "Trivia is not configured." }, 503);

  const result = await submitTriviaAnswer(admin, {
    playerToken: token,
    choiceIndex: parsed.data.choiceIndex,
  });

  if (!result.ok) return publicTriviaJson({ ok: false, error: result.message }, 409);
  return publicTriviaJson({ ok: true, message: result.message });
}
