import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { joinPublicUrl } from "@/lib/public/urls";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isMissingTriviaRelation } from "@/lib/trivia/engine";
import { buildPublicWallState } from "@/lib/trivia/runtime";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) return publicJson({ error: "Trivia is not configured." }, 503);

  const origin = getPublicAppUrl();
  const { wall, error } = await buildPublicWallState(admin, FLO_BAMA_VENUE_ID, (code) =>
    joinPublicUrl(origin, `/play/${code}`),
  );

  if (error) {
    if (isMissingTriviaRelation(error)) return publicJson({ trivia: null }, 200, PUBLIC_NO_STORE);
    return publicJson({ error }, 500);
  }

  return publicJson({ trivia: wall }, 200, PUBLIC_NO_STORE);
}
