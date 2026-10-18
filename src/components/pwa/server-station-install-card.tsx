"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function ServerStationInstallCard({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandaloneDisplay);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-[#e8d5c4]",
          className,
        )}
      >
        <p className="font-medium text-[#f7efe6]">Flobama Toolkit is installed on this device.</p>
        <p className="mt-1">Open it from the home screen or dock for one-tap access.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-2xl border border-white/15 bg-black/25 p-4", className)}>
      <div>
        <p className="font-medium text-[#f7efe6]">Install Flobama Toolkit</p>
        <p className="mt-1 text-sm text-[#e8d5c4]/90">
          Add it to your home screen. It opens full screen with the FloBama logo.
        </p>
      </div>
      {deferred ? (
        <button
          type="button"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#d36b4a] px-4 text-base font-semibold text-[#14110f]"
          onClick={async () => {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setDeferred(null);
          }}
        >
          Install app
        </button>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[#e8d5c4]/90">
          <li>Chrome or Edge → open the browser menu (⋮).</li>
          <li>Choose Install Flobama Toolkit / Install app.</li>
          <li>Open the new home-screen or dock icon and sign in with your PIN.</li>
        </ol>
      )}
    </div>
  );
}
