import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { loadSharedTriviaWall } from "@/lib/trivia/shared-wall";
import { normalizeTriviaWallToken } from "@/lib/trivia/wall-share";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const loaded = await loadSharedTriviaWall(normalizeTriviaWallToken(token));
  if (loaded.status === "invalid") return publicJson({ error: "Not found." }, 404, PUBLIC_NO_STORE);
  if (loaded.status === "unconfigured") {
    return publicJson({ error: "Trivia is not configured." }, 503, PUBLIC_NO_STORE);
  }
  if (loaded.status === "error") {
    return publicJson({ error: "Trivia wall is unavailable." }, 500, PUBLIC_NO_STORE);
  }
  return publicJson({ trivia: loaded.wall }, 200, PUBLIC_NO_STORE);
}
