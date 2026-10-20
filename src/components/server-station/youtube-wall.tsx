"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { playYoutubeOnWallAction } from "@/actions/server-station";
import {
  ServerStationButton,
  ServerStationField,
  ServerStationShell,
  serverStationInputClass,
} from "@/components/server-station/shell";
import { parseYoutubeVideoUrl } from "@/lib/screens/youtube";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

export function ServerStationYoutubeWall({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(false);

  const parsed = parseYoutubeVideoUrl(url);

  function play() {
    startTransition(async () => {
      setResultMessage(null);
      const result = await playYoutubeOnWallAction({ url });
      setResultOk(result.ok);
      setResultMessage(result.message);
      if (result.ok) {
        toast.success(result.message);
        setUrl("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="YouTube">
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">YouTube on the wall</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          Paste a video link to play it on the LED wall. When it finishes, the wall returns to normal
          programming.
        </p>
      </div>

      <div className="space-y-4 rounded-[28px] border border-white/10 bg-black/25 p-4 lg:p-5">
        <ServerStationField label="YouTube link">
          <input
            className={cn(serverStationInputClass, "font-normal")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={pending}
          />
        </ServerStationField>

        {parsed ? (
          <p className="text-sm text-[#9ad7ff]">Ready · video {parsed.videoId}</p>
        ) : url.trim() ? (
          <p className="text-sm text-[#ffb4a2]">Need a full YouTube video link (watch, youtu.be, or Shorts).</p>
        ) : null}

        <ServerStationButton
          type="button"
          disabled={pending || !parsed}
          onClick={play}
          className="w-full"
        >
          {pending ? "Sending…" : "Play on wall"}
        </ServerStationButton>

        {resultMessage ? (
          <p className={cn("text-base", resultOk ? "text-[#9ad7ff]" : "text-[#ffb4a2]")}>{resultMessage}</p>
        ) : null}
      </div>
    </ServerStationShell>
  );
}
