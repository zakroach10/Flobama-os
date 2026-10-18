"use client";

import { useEffect } from "react";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { ServerStationButton } from "@/components/server-station/shell";

export default function ServerStationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Server Station error", error);
  }, [error]);

  return (
    <div className="dark flex h-full flex-col items-center justify-center overflow-y-auto bg-[#100e0c] px-4 text-center text-foreground">
      <FlobamaLogo className="h-10 w-auto max-w-[180px] brightness-110" />
      <h1 className="mt-8 text-3xl font-bold text-[#f7efe6]">Server Station couldn’t load</h1>
      <p className="mt-3 max-w-md text-lg text-[#e8d5c4]">
        Something went wrong on this screen. Reload and try again. If it keeps happening, lock and unlock with
        your PIN.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ServerStationButton onClick={() => reset()}>Reload</ServerStationButton>
        <ServerStationButton variant="secondary" onClick={() => {
          window.location.href = "/server/login";
        }}>
          Back to unlock
        </ServerStationButton>
      </div>
    </div>
  );
}
