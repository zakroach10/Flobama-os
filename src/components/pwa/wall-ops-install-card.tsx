"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
    // iOS Safari
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function WallOpsInstallCard({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandaloneDisplay);
  const [hint, setHint] = useState<string | null>(null);

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
      <div className={cn("rounded-xl border border-border/80 bg-card/70 p-4 text-sm text-muted-foreground", className)}>
        <p className="font-medium text-foreground">FloBama Screens is installed on this computer.</p>
        <p className="mt-1">Launch it from the desktop or dock. You stay signed in until you log out or the session is revoked.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-xl border border-border/80 bg-card/70 p-4", className)}>
      <div>
        <p className="font-medium text-foreground">Install FloBama Screens</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Install this console as an app so it opens in its own window from the desktop or dock.
        </p>
      </div>
      {deferred ? (
        <Button
          type="button"
          className="w-full min-h-11"
          onClick={async () => {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setDeferred(null);
          }}
        >
          Install app
        </Button>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Chrome or Edge → open the browser menu (⋮).</li>
          <li>Choose <span className="text-foreground">Install FloBama Screens</span> / Install app / Install page as app.</li>
          <li>Open the new desktop or dock icon. Sign in once on this computer.</li>
        </ol>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full text-foreground"
        onClick={() =>
          setHint(
            "Optional: Windows — Settings → Apps → Startup, or pin the app and add a shortcut to the Startup folder. macOS — System Settings → General → Login Items → add FloBama Screens. A PWA cannot force the computer to stay awake.",
          )
        }
      >
        Auto-start tips
      </Button>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
