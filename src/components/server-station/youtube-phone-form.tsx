"use client";

import { useState, useTransition } from "react";
import { parseYoutubeVideoUrl } from "@/lib/screens/youtube";
import { ServerStationButton, serverStationInputClass } from "@/components/server-station/shell";
import { cn } from "@/lib/utils";

export function ServerStationYoutubePhoneForm({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const parsed = parseYoutubeVideoUrl(url);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        setError(null);
        if (!parsed) {
          setError("Paste a full YouTube video link (watch, youtu.be, or Shorts).");
          return;
        }
        startTransition(async () => {
          try {
            const response = await fetch("/api/public/v1/server-station/youtube/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, url: parsed.watchUrl }),
            });
            const json = (await response.json()) as { error?: string; message?: string };
            if (!response.ok) {
              setError(json.error ?? "Could not send the link.");
              return;
            }
            setMessage(json.message ?? "Link sent to the Server Station.");
            setUrl("");
          } catch {
            setError("Network error. Try again.");
          }
        });
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[#e8d5c4]">YouTube link</span>
        <input
          className={cn(serverStationInputClass, "font-normal")}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={pending || Boolean(message)}
        />
      </label>
      {parsed ? <p className="text-sm text-[#9ad7ff]">Ready · {parsed.videoId}</p> : null}
      <ServerStationButton type="submit" disabled={pending || !parsed || Boolean(message)} className="w-full">
        {pending ? "Sending…" : message ? "Sent" : "Send to Server Station"}
      </ServerStationButton>
      {message ? <p className="text-sm text-[#9ad7ff]">{message}</p> : null}
      {error ? <p className="text-sm text-[#ffb4a2]">{error}</p> : null}
    </form>
  );
}
