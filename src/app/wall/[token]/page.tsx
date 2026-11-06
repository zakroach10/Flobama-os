import { notFound } from "next/navigation";
import { TriviaWallMessage, TriviaWallStage } from "@/components/screens/trivia-wall-stage";
import { getPublicAppUrl } from "@/lib/env";
import { demoTriviaPodiumWall, demoTriviaQuestionWall, demoTriviaWall } from "@/lib/trivia/demo";
import { loadSharedTriviaWall } from "@/lib/trivia/shared-wall";
import { normalizeTriviaWallToken, triviaWallPollPath, verifyTriviaWallShareToken } from "@/lib/trivia/wall-share";

export const dynamic = "force-dynamic";

export default async function TriviaWallSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ demo?: string; phase?: string }>;
}) {
  const { token: rawToken } = await params;
  const token = normalizeTriviaWallToken(rawToken);
  const verified = verifyTriviaWallShareToken(token);
  if (!verified.ok) notFound();

  const query = await searchParams;
  const pollPath = triviaWallPollPath(token);
  const demoPhase =
    process.env.NODE_ENV === "production"
      ? null
      : query.phase === "question" || query.demo === "question"
        ? "question"
        : query.phase === "podium" || query.demo === "podium"
          ? "podium"
          : query.demo === "1" || query.phase === "lobby"
            ? "lobby"
            : null;
  if (demoPhase) {
    const origin = getPublicAppUrl();
    const trivia =
      demoPhase === "question"
        ? demoTriviaQuestionWall(origin)
        : demoPhase === "podium"
          ? demoTriviaPodiumWall(origin)
          : demoTriviaWall(origin);
    return <TriviaWallStage initial={trivia} pollPath={pollPath} lockDemo />;
  }

  const loaded = await loadSharedTriviaWall(token);
  if (loaded.status === "invalid") notFound();
  if (loaded.status === "unconfigured") {
    return <TriviaWallMessage title="Trivia wall is not configured." />;
  }
  if (loaded.status === "error") {
    return <TriviaWallMessage title="Trivia wall is unavailable." />;
  }
  return <TriviaWallStage initial={loaded.wall} pollPath={loaded.pollPath} />;
}
