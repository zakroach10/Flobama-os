import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { TriviaWall } from "@/components/screens/trivia-wall";
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
    <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#3a241c_0%,#100e0c_62%)] px-16 text-center text-[#f7efe6]">
      <FlobamaLogo className="h-[200px] w-auto" priority />
      <p className="mt-10 text-[28px] tracking-[0.32em] text-[#d36b4a] uppercase">Live trivia</p>
      <p className="mt-4 text-[92px] leading-none">Next game shows up here</p>
      <p className="mt-6 max-w-[1100px] font-sans text-[36px] leading-snug text-[#cbb7a8]">
        Have your phone ready. The join code and QR appear when the game starts.
      </p>
    </div>
  );
}
