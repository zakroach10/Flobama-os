"use client";

import { useEffect, useState } from "react";
import { AudienceWall } from "@/components/audience/audience-wall";
import { AUDIENCE_WALL_HEIGHT, AUDIENCE_WALL_WIDTH } from "@/lib/constants";
import type { AudienceObsBackground, AudienceWallState } from "@/lib/audience/types";

export function AudienceObsStage({
  initial,
  pollPath,
  background,
  lockDemo = false,
  initialQr = null,
}: {
  initial: AudienceWallState;
  pollPath: string;
  background: AudienceObsBackground;
  lockDemo?: boolean;
  initialQr?: string | null;
}) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function fit() {
      const next = Math.min(window.innerWidth / AUDIENCE_WALL_WIDTH, window.innerHeight / AUDIENCE_WALL_HEIGHT);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div
      className={`flex h-full w-full items-center justify-center overflow-hidden ${
        background === "transparent" ? "bg-transparent" : "bg-[#07090d]"
      }`}
    >
      <div
        className="origin-center shrink-0"
        style={{
          width: AUDIENCE_WALL_WIDTH,
          height: AUDIENCE_WALL_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <AudienceWall
          initial={initial}
          pollPath={pollPath}
          background={background}
          lockDemo={lockDemo}
          initialQr={initialQr}
        />
      </div>
    </div>
  );
}
