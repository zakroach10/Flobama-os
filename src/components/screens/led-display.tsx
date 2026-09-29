"use client";

import { useEffect, useState } from "react";
import { LED_DISPLAY_POLL_MS } from "@/lib/constants";
import type { PublicLedMedia } from "@/lib/screens/led-wall";
import {
  holdMsForLedPlaylistItem,
  nextLedPlaylistIndex,
  type PublicLedPlaylistItem,
} from "@/lib/screens/led-playlists";
import type { TriviaWallState } from "@/lib/trivia/types";
import { TriviaWall } from "@/components/screens/trivia-wall";

type LedApiPayload = {
  active?: PublicLedMedia | null;
  mode?: "idle" | "scene" | "playlist";
  playlist?: PublicLedPlaylistItem[];
  playlistId?: string | null;
  startedAt?: string | null;
  revision?: string;
  reloadNonce?: number;
};

export function LedDisplay({
  initial,
  initialPlaylist = [],
  initialMode = initial ? "scene" : "idle",
  initialRevision = initial?.id ?? "idle",
  initialReloadNonce = 1,
  initialTrivia = null,
  lockTriviaDemo = false,
}: {
  initial: PublicLedMedia | null;
  initialPlaylist?: PublicLedPlaylistItem[];
  initialMode?: "idle" | "scene" | "playlist";
  initialRevision?: string;
  initialReloadNonce?: number;
  initialTrivia?: TriviaWallState | null;
  lockTriviaDemo?: boolean;
}) {
  const [media, setMedia] = useState<PublicLedMedia | null>(initial);
  const [playlist, setPlaylist] = useState<PublicLedPlaylistItem[]>(initialPlaylist);
  const [mode, setMode] = useState<"idle" | "scene" | "playlist">(initialMode);
  const [revision, setRevision] = useState(initialRevision);
  const [reloadNonce, setReloadNonce] = useState(initialReloadNonce);
  const [index, setIndex] = useState(0);
  const [trivia, setTrivia] = useState<TriviaWallState | null>(initialTrivia);

  useEffect(() => {
    if (lockTriviaDemo) return;
    let cancelled = false;
    async function refresh() {
      try {
        const [ledRes, triviaRes] = await Promise.all([
          fetch("/api/public/v1/screens/led", { cache: "no-store" }),
          fetch("/api/public/v1/trivia/wall", { cache: "no-store" }),
        ]);
        const ledJson = (await ledRes.json()) as LedApiPayload;
        const triviaJson = (await triviaRes.json()) as { trivia?: TriviaWallState | null };
        if (cancelled) return;
        const nextReload = typeof ledJson.reloadNonce === "number" ? ledJson.reloadNonce : reloadNonce;
        if (nextReload !== reloadNonce) {
          window.location.reload();
          return;
        }
        setTrivia(triviaJson.trivia ?? null);
        const nextRevision = ledJson.revision ?? "idle";
        const nextMode = ledJson.mode ?? (ledJson.active ? "scene" : "idle");
        const nextPlaylist = ledJson.playlist ?? [];
        if (nextRevision !== revision || nextMode !== mode) {
          setRevision(nextRevision);
          setMode(nextMode);
          setPlaylist(nextPlaylist);
          setIndex(0);
          setMedia(ledJson.active ?? null);
          return;
        }
        if (nextMode === "playlist") {
          setPlaylist(nextPlaylist);
        } else {
          setMedia(ledJson.active ?? null);
          setPlaylist([]);
        }
        setReloadNonce(nextReload);
      } catch {
        /* keep current frame */
      }
    }
    const timer = window.setInterval(() => void refresh(), LED_DISPLAY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lockTriviaDemo, mode, revision, reloadNonce]);

  useEffect(() => {
    if (mode !== "playlist" || playlist.length === 0 || trivia) return;
    const item = playlist[index];
    if (!item) return;
    const holdMs = holdMsForLedPlaylistItem(item);
    if (holdMs <= 0) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => nextLedPlaylistIndex(current, playlist.length));
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [mode, playlist, index, trivia]);

  if (trivia) return <TriviaWall initial={trivia} lockDemo={lockTriviaDemo} />;

  if (mode === "playlist" && playlist.length > 0) {
    const item = playlist[index] ?? playlist[0];
    if (!item || item.kind === "obs") {
      return <div className="h-full w-full bg-black" />;
    }
    if (item.kind === "media" && item.url && item.mediaKind === "video") {
      return (
        <video
          key={item.id}
          src={item.url}
          className="h-full w-full bg-black object-contain"
          autoPlay
          muted
          playsInline
          onEnded={() => setIndex((current) => nextLedPlaylistIndex(current, playlist.length))}
        />
      );
    }
    if (item.kind === "media" && item.url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={item.id} src={item.url} alt="" className="h-full w-full bg-black object-contain" />
      );
    }
    return <div className="h-full w-full bg-black" />;
  }

  if (!media) return <div className="h-full w-full bg-black" />;

  if (media.mediaKind === "video") {
    return (
      <video
        key={media.id}
        src={media.url}
        className="h-full w-full bg-black object-contain"
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={media.id} src={media.url} alt="" className="h-full w-full bg-black object-contain" />
  );
}
