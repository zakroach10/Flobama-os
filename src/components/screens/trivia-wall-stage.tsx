import { TriviaWall } from "@/components/screens/trivia-wall";
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
    <div className="flex h-full w-full items-center justify-center bg-[#100e0c] px-8 text-center text-3xl font-semibold text-[#f7f1ea]">
      {title}
    </div>
  );
}

function TriviaWallStandby() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#3a241c_0%,#100e0c_70%)] px-8 text-center text-[#f7efe6]">
      <p className="text-sm font-semibold tracking-[0.28em] text-[#d36b4a] uppercase">Live Trivia</p>
      <p className="mt-4 text-5xl font-black tracking-[0.14em]">FLOBAMA</p>
      <p className="mt-4 text-2xl text-[#cbb7a8]">Waiting for the next game</p>
    </div>
  );
}
