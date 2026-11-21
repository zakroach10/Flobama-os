"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUDIENCE_OBS_FPS, AUDIENCE_WALL_HEIGHT, AUDIENCE_WALL_WIDTH } from "@/lib/constants";
import type { AudienceObsBackground } from "@/lib/audience/types";

export function AudienceObsSourcePanel({
  solidUrl,
  transparentUrl,
}: {
  solidUrl: string | null;
  transparentUrl: string | null;
}) {
  const [background, setBackground] = useState<AudienceObsBackground>("solid");
  const url = background === "transparent" ? transparentUrl : solidUrl;

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("OBS browser source link copied."),
      () => toast.error("Could not copy. Select the link and copy it manually."),
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">OBS browser source</h2>
        <p className="text-sm text-muted-foreground">
          Paste this into an OBS Browser source. It is the live audience wall from the production site — no local
          runner. The link stays the same from show to show and follows whichever session is live at this venue.
          Reloading the source keeps the same address. Branding and the corner sponsor stay on the wall.
        </p>
      </div>
      {url ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Wall background">
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              variant={background === "solid" ? "default" : "outline"}
              onClick={() => setBackground("solid")}
            >
              Solid background
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              variant={background === "transparent" ? "default" : "outline"}
              onClick={() => setBackground("transparent")}
            >
              Transparent background
            </Button>
          </div>
          <Input readOnly value={url} aria-label="OBS browser source link" className="font-mono text-xs" />
          <Button type="button" className="min-h-11" onClick={copy}>
            Copy link
          </Button>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">OBS Browser source settings</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Width {AUDIENCE_WALL_WIDTH}, height {AUDIENCE_WALL_HEIGHT}. The page scales if the source is a
                different size.
              </li>
              <li>FPS {AUDIENCE_OBS_FPS}. Leave custom CSS empty.</li>
              <li>Check “Refresh browser when scene becomes active” so a cut back reloads a new show.</li>
              <li>
                Leave “Shutdown source when not visible” unchecked so the wall keeps updating between looks. If you
                turn shutdown on, keep refresh-when-active checked.
              </li>
              <li>Uncheck “Control audio via OBS”. This page has no audio.</li>
            </ul>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Set CRON_SECRET, or the service role key, on the server to publish this link. Then reload Audience
          Interactor.
        </p>
      )}
    </section>
  );
}
