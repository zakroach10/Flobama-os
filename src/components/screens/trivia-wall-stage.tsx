import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { TriviaWall } from "@/components/screens/trivia-wall";
import { TRIVIA_WALL_CLEAR_HEIGHT } from "@/lib/constants";
import { triviaDisplayFont } from "@/lib/trivia/display-font";
import type { TriviaWallState } from "@/lib/trivia/types";

export function TriviaWallStage({
  initial,
  pollPath,
  lockDemo = false,
  showSafeLine = false,
}: {
  initial: TriviaWallState | null;
  pollPath: string;
  lockDemo?: boolean;
  showSafeLine?: boolean;
}) {
  return (
    <div className="h-full w-full bg-[#100e0c]">
      <TriviaWall
        initial={initial}
        pollPath={pollPath}
        lockDemo={lockDemo}
        showSafeLine={showSafeLine}
        empty={<TriviaWallStandby />}
      />
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
    <div
      className="grid h-full bg-[radial-gradient(ellipse_at_top,#3a241c_0%,#100e0c_62%)] text-[#f7efe6]"
      style={{ gridTemplateRows: `${TRIVIA_WALL_CLEAR_HEIGHT}px minmax(0, 1fr)` }}
    >
      <div data-above-chairs className="flex flex-col justify-center px-16">
        <FlobamaLogo className="h-[150px] w-auto" priority />
        <p className="mt-6 text-[22px] tracking-[0.32em] text-[#d36b4a] uppercase">Live trivia</p>
        <p className="mt-3 text-[72px] leading-none">Next game shows up here</p>
        <p className="mt-4 max-w-[980px] font-sans text-[28px] leading-snug text-[#cbb7a8]">
          Have your phone ready. The join code and QR appear when the game starts.
        </p>
      </div>
      <div className="relative flex items-end overflow-hidden border-t border-white/15 px-14 pb-8">
        <p aria-hidden className="pointer-events-none absolute -bottom-6 left-8 text-[160px] leading-none text-[#d36b4a] opacity-25">
          Trivia
        </p>
        <p className="relative text-[26px] tracking-[0.32em] text-[#cbb7a8] uppercase">FloBama Music Hall</p>
      </div>
    </div>
  );
}
