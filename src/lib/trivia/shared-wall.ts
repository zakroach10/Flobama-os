import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPublicAppUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";
import { isMissingTriviaRelation } from "@/lib/trivia/engine";
import { buildPublicWallState } from "@/lib/trivia/runtime";
import type { TriviaWallState } from "@/lib/trivia/types";
import { triviaWallPollPath, verifyTriviaWallShareToken } from "@/lib/trivia/wall-share";

export type SharedTriviaWall =
  | { status: "invalid" }
  | { status: "unconfigured" }
  | { status: "error" }
  | { status: "ready"; venueId: string; wall: TriviaWallState | null; pollPath: string };

/** Public trivia output for a share token. No staff session and no answer key before reveal. */
export async function loadSharedTriviaWall(token: string): Promise<SharedTriviaWall> {
  const verified = verifyTriviaWallShareToken(token);
  if (!verified.ok) return { status: "invalid" };

  const admin = createServiceRoleClient();
  if (!admin) return { status: "unconfigured" };

  const origin = getPublicAppUrl();
  const { wall, error } = await buildPublicWallState(admin, verified.venueId, (code) =>
    joinPublicUrl(origin, `/play/${code}`),
  );
  if (error && !isMissingTriviaRelation(error)) return { status: "error" };

  return {
    status: "ready",
    venueId: verified.venueId,
    wall,
    pollPath: triviaWallPollPath(token),
  };
}
