import { publicOptions } from "@/lib/public/http";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readTriviaPlayerToken, publicTriviaJson } from "@/lib/trivia/http";
import { getPlayerState } from "@/lib/trivia/runtime";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const token = await readTriviaPlayerToken();
  if (!token) return publicTriviaJson({ player: null });

  const admin = createServiceRoleClient();
  if (!admin) return publicTriviaJson({ error: "Trivia is not configured." }, 503);

  const { state, error } = await getPlayerState(admin, token);
  if (error) return publicTriviaJson({ error }, 500);
  return publicTriviaJson({ player: state });
}
