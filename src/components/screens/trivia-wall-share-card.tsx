"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TRIVIA_OBS_COLLECTION_FILENAME, buildTriviaObsSceneCollection } from "@/lib/trivia/obs-collection";

export function TriviaWallShareCard({
  shareUrl,
  compact = false,
}: {
  shareUrl: string | null;
  compact?: boolean;
}) {
  function copy() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(
      () => toast.success("Wall link copied."),
      () => toast.error("Could not copy. Select the link and copy it manually."),
    );
  }

  function download() {
    if (!shareUrl) return;
    const collection = buildTriviaObsSceneCollection({ url: shareUrl });
    const blob = new Blob([`${JSON.stringify(collection, null, 2)}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = TRIVIA_OBS_COLLECTION_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  return (
    <section className={compact ? "space-y-2 px-1 py-1" : "space-y-3 rounded-xl border bg-card p-5"}>
      <div>
        <h2 className={compact ? "text-sm font-semibold" : "text-lg font-semibold"}>Trivia LED wall</h2>
        <p className="text-sm text-muted-foreground">
          Display-only link for OBS. It shows the live trivia wall, follows the game, and holds a standby frame between
          games. The page has no sign-in and no controls. The address stays the same from night to night.
        </p>
      </div>
      {shareUrl ? (
        <>
          <Input readOnly value={shareUrl} aria-label="Trivia LED wall link" className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size={compact ? "sm" : "default"} onClick={copy}>
              Copy link
            </Button>
            <Button type="button" size={compact ? "sm" : "default"} variant="outline" onClick={download}>
              Download OBS scene
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            In OBS choose Scene Collection → Import and open {TRIVIA_OBS_COLLECTION_FILENAME}. The scene is “LED Wall -
            Trivia”, 1920×1080. Set the canvas to 1920×1080 if it is not already.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Set CRON_SECRET, or the service role key, on the server to publish this link. Then reload Screens.
        </p>
      )}
    </section>
  );
}
