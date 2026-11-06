import { TriviaWall } from "@/components/screens/trivia-wall";
import { FLOBAMA_LOGO_ALT, FLOBAMA_LOGO_SRC } from "@/lib/brand";
import { triviaDisplayFont } from "@/lib/trivia/display-font";
import type { TriviaWallState } from "@/lib/trivia/types";

export function TriviaWallStage({
  initial,
  pollPath,
  lockDemo = false,
}: {
  initial: TriviaWallState | null;
  pollPath: string;
  lockDemo?: boolean;
}) {
  return (
    <div className="h-full w-full bg-[#100e0c]">
      <TriviaWall initial={initial} pollPath={pollPath} lockDemo={lockDemo} empty={<TriviaWallStandby />} />
    </div>
  );
}

export function TriviaWallMessage({ title }: { title: string }) {
  return (
    <div
      className={`${triviaDisplayFont.className} flex h-full w-full items-center justify-center bg-[#100e0c] px-8 text-center text-5xl text-[#f7f1ea]`}
    >
      {title}
    </div>
  );
}

function TriviaWallStandby() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#3a241c_0%,#100e0c_62%)] px-16 pb-28">
      {/* Intrinsic 1500×488. Width is capped; height follows so the wordmark is not stretched. */}
      <img
        src={FLOBAMA_LOGO_SRC}
        alt={FLOBAMA_LOGO_ALT}
        width={1500}
        height={488}
        draggable={false}
        fetchPriority="high"
        className="h-auto w-[640px] max-w-[78%] object-contain"
      />
      <div
        className="mt-12 size-[72px] rounded-full border-4 border-white/15 border-t-[#e7a15a] motion-safe:animate-spin"
        role="status"
        aria-label="Waiting for the next game"
      />
    </div>
  );
}
