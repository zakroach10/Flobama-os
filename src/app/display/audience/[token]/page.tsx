import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AudienceObsStage } from "@/components/audience/audience-obs-stage";
import { demoGuessBubblesWall, demoGuessWinnerWall } from "@/lib/audience/demo";
import { getAudienceObsFrame } from "@/lib/audience/runtime";
import {
  audienceObsBackground,
  audienceWallPollPath,
  normalizeAudienceWallToken,
  verifyAudienceWallShareToken,
} from "@/lib/audience/wall-share";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getTriviaPublicUrl } from "@/lib/env";
import type { AudienceWallState } from "@/lib/audience/types";

export const dynamic = "force-dynamic";

async function joinQr(wall: AudienceWallState) {
  if (!wall.joinCode) return null;
  return QRCode.toDataURL(`${getTriviaPublicUrl()}${wall.joinPath}`, { margin: 1, width: 280 });
}

export default async function AudienceObsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ bg?: string; demo?: string; phase?: string }>;
}) {
  const { token: rawToken } = await params;
  const token = normalizeAudienceWallToken(rawToken);
  const verified = verifyAudienceWallShareToken(token);
  if (!verified.ok) notFound();

  const query = await searchParams;
  const background = audienceObsBackground(query.bg);
  const pollPath = audienceWallPollPath(token);

  if (process.env.NODE_ENV !== "production" && (query.demo === "guess" || query.demo === "1")) {
    const base = query.phase === "winner" ? demoGuessWinnerWall() : demoGuessBubblesWall();
    const initial: AudienceWallState = {
      ...base,
      brandLogoUrl: "/flobama-logo.png",
      cornerSponsor: {
        name: "Acme Motors",
        imageUrl: "/flobama-logo.png",
        corner: "bottom-left",
        phone: "(256) 555-0199",
        message: "Presented tonight",
      },
    };
    return (
      <AudienceObsStage
        initial={initial}
        pollPath={pollPath}
        background={background}
        lockDemo
        initialQr={await joinQr(initial)}
      />
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#07090d] px-8 text-center">
        <p className="text-2xl font-semibold">Audience wall is not configured.</p>
      </div>
    );
  }
  const frame = await getAudienceObsFrame(admin, verified.venueId);
  if (!frame.ok) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#07090d] px-8 text-center">
        <p className="text-2xl font-semibold">Audience wall is unavailable.</p>
      </div>
    );
  }
  return (
    <AudienceObsStage
      initial={frame.wall}
      pollPath={pollPath}
      background={background}
      initialQr={await joinQr(frame.wall)}
    />
  );
}
