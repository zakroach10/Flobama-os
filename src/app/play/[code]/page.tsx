import { TriviaPlayClient } from "@/components/trivia/play-client";

export const dynamic = "force-dynamic";

export default async function TriviaPlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TriviaPlayClient joinCode={code.toUpperCase()} />;
}
