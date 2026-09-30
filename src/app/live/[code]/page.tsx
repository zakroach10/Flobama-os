import { AudiencePlayClient } from "@/components/audience/audience-play-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export default async function AudienceLiveJoinPage({ params }: Params) {
  const { code } = await params;
  const cleaned = code.trim().toUpperCase().slice(0, 8);
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AudiencePlayClient joinCode={cleaned} />
    </main>
  );
}
