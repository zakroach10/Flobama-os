import { AudiencePlayClient } from "@/components/audience/audience-play-client";
import { demoGuessGuest } from "@/lib/audience/demo";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ demo?: string }>;
};

export default async function AudienceLiveJoinPage({ params, searchParams }: Params) {
  const { code } = await params;
  const query = await searchParams;
  const cleaned = code.trim().toUpperCase().slice(0, 8);
  if (process.env.NODE_ENV !== "production" && query.demo === "guess") {
    return (
      <main className="min-h-dvh bg-background text-foreground">
        <AudiencePlayClient joinCode={cleaned || "LIVE01"} initialState={demoGuessGuest(cleaned || "LIVE01")} lockDemo />
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AudiencePlayClient joinCode={cleaned} />
    </main>
  );
}
