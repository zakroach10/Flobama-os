"use client";

import { useEffect, useRef, useState } from "react";
import { LED_DISPLAY_POLL_MS } from "@/lib/constants";
import type { PublicLedMedia } from "@/lib/screens/led-wall";
import {
  ledPlaylistIndexAt,
  ledPlaylistsEqual,
  nextLedPlaylistMediaItem,
  type PublicLedPlaylistItem,
} from "@/lib/screens/led-playlists";
import type { TriviaWallState } from "@/lib/trivia/types";
import type { AudienceWallState } from "@/lib/audience/types";
import { TriviaWall } from "@/components/screens/trivia-wall";
import { AudienceWall } from "@/components/audience/audience-wall";

type LedApiPayload = {
  active?: PublicLedMedia | null;
  mode?: "idle" | "scene" | "playlist";
  playlist?: PublicLedPlaylistItem[];
  playlistId?: string | null;
  startedAt?: string | null;
  revision?: string;
  reloadNonce?: number;
  error?: string;
};

export function LedDisplay({
  initial,
  initialPlaylist = [],
  initialMode = initial ? "scene" : "idle",
  initialRevision = initial?.id ?? "idle",
  initialReloadNonce = 1,
  initialStartedAt = null,
  initialTrivia = null,
  initialAudience = null,
  lockTriviaDemo = false,
}: {
  initial: PublicLedMedia | null;
  initialPlaylist?: PublicLedPlaylistItem[];
  initialMode?: "idle" | "scene" | "playlist";
  initialRevision?: string;
  initialReloadNonce?: number;
  initialStartedAt?: string | null;
  initialTrivia?: TriviaWallState | null;
  initialAudience?: AudienceWallState | null;
  lockTriviaDemo?: boolean;
}) {
  const [media, setMedia] = useState<PublicLedMedia | null>(initial);
  const [playlist, setPlaylist] = useState<PublicLedPlaylistItem[]>(initialPlaylist);
  const [mode, setMode] = useState<"idle" | "scene" | "playlist">(initialMode);
  const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt);
  const [index, setIndex] = useState(() =>
    initialMode === "playlist" ? ledPlaylistIndexAt(initialPlaylist, initialStartedAt) : 0,
  );
  const [trivia, setTrivia] = useState<TriviaWallState | null>(initialTrivia);
  const [audience, setAudience] = useState<AudienceWallState | null>(initialAudience);
  const reloadNonceRef = useRef(initialReloadNonce);
  const revisionRef = useRef(initialRevision);
  const modeRef = useRef(initialMode);
  const overlayKeyRef = useRef(overlayStateKey(initialTrivia, initialAudience));

  useEffect(() => {
    if (lockTriviaDemo) return;
    let cancelled = false;
    async function refresh() {
      try {
        const [ledRes, triviaRes, audienceRes] = await Promise.all([
          fetch("/api/public/v1/screens/led", { cache: "no-store" }),
          fetch("/api/public/v1/trivia/wall", { cache: "no-store" }),
          fetch("/api/public/v1/audience/wall", { cache: "no-store" }),
        ]);
        if (!ledRes.ok) return;
        const ledJson = (await ledRes.json()) as LedApiPayload;
        const triviaJson = (await triviaRes.json()) as { trivia?: TriviaWallState | null };
        const audienceJson = (await audienceRes.json()) as { wall?: AudienceWallState | null };
        if (cancelled || ledJson.error) return;

        if (typeof ledJson.reloadNonce === "number" && ledJson.reloadNonce !== reloadNonceRef.current) {
          reloadNonceRef.current = ledJson.reloadNonce;
          window.location.reload();
          return;
        }

        const nextTrivia = triviaJson.trivia ?? null;
        const nextAudience = audienceJson.wall ?? null;
        const nextOverlayKey = overlayStateKey(nextTrivia, nextAudience);
        if (nextOverlayKey !== overlayKeyRef.current) {
          overlayKeyRef.current = nextOverlayKey;
          setTrivia(nextTrivia);
          setAudience(nextAudience);
        }

        const nextRevision = ledJson.revision ?? "idle";
        const nextMode = ledJson.mode ?? (ledJson.active ? "scene" : "idle");
        const nextPlaylist = ledJson.playlist ?? [];
        const nextStartedAt = ledJson.startedAt ?? null;

        if (nextRevision !== revisionRef.current || nextMode !== modeRef.current) {
          revisionRef.current = nextRevision;
          modeRef.current = nextMode;
          setMode(nextMode);
          setPlaylist(nextPlaylist);
          setStartedAt(nextStartedAt);
          setIndex(nextMode === "playlist" ? ledPlaylistIndexAt(nextPlaylist, nextStartedAt) : 0);
          setMedia(ledJson.active ?? null);
          return;
        }

        if (nextMode === "playlist") {
          setPlaylist((current) => (ledPlaylistsEqual(current, nextPlaylist) ? current : nextPlaylist));
          setStartedAt((current) => (current === nextStartedAt ? current : nextStartedAt));
        } else {
          setMedia(ledJson.active ?? null);
          setPlaylist([]);
          setStartedAt(null);
        }
      } catch {
        /* keep current frame on network errors */
      }
    }
    const timer = window.setInterval(() => void refresh(), LED_DISPLAY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lockTriviaDemo]);

  // Keep display + OBS agent on the same time-based playlist slot (wraps / loops).
  useEffect(() => {
    if (mode !== "playlist" || playlist.length === 0 || trivia || audience?.tool) return;
    const sync = () => {
      const next = ledPlaylistIndexAt(playlist, startedAt);
      setIndex((current) => (current === next ? current : next));
    };
    sync();
    const timer = window.setInterval(sync, 250);
    return () => window.clearInterval(timer);
  }, [mode, playlist, startedAt, trivia, audience?.tool]);

  // Trivia takes precedence if both somehow live; otherwise show audience wall only when a tool is up.
  if (trivia) return <TriviaWall initial={trivia} lockDemo={lockTriviaDemo} />;
  if (audience?.tool) return <AudienceWall initial={audience} />;

  if (mode === "playlist" && playlist.length > 0) {
    return <LedPlaylistStage playlist={playlist} index={index} />;
  }

  // Audience lobby (session live, nothing on wall) only when LED is not running an ad-roll playlist.
  if (audience) return <AudienceWall initial={audience} />;

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
        preload="auto"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={media.id} src={media.url} alt="" className="h-full w-full bg-black object-contain" />
  );
}

function LedPlaylistStage({ playlist, index }: { playlist: PublicLedPlaylistItem[]; index: number }) {
  const current = playlist[index] ?? playlist[0];
  if (!current) return <div className="h-full w-full bg-black" />;

  const warm = nextLedPlaylistMediaItem(playlist, index);
  const surfaces: PublicLedPlaylistItem[] = [];
  if (current.kind === "media" && current.url && current.mediaKind) {
    surfaces.push(current);
  }
  if (warm && warm.id !== current.id) {
    surfaces.push(warm);
  }

  return (
    <div className="relative h-full w-full bg-black">
      {surfaces.map((item) => (
        <LedMediaSurface
          key={item.id}
          item={item}
          active={item.id === current.id}
          loop={playlist.length === 1}
        />
      ))}
    </div>
  );
}

function LedMediaSurface({
  item,
  active,
  loop,
}: {
  item: PublicLedPlaylistItem;
  active: boolean;
  loop: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore seek before metadata */
      }
      void video.play().catch(() => {
        /* autoplay can be blocked until a booth gesture; muted + playsInline usually ok */
      });
      return;
    }
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, [active, item.url]);

  if (item.kind !== "media" || !item.url) return null;

  const className = active
    ? "absolute inset-0 z-10 h-full w-full bg-black object-contain opacity-100"
    : "pointer-events-none absolute inset-0 z-0 h-full w-full bg-black object-contain opacity-0";

  if (item.mediaKind === "video") {
    return (
      <video
        ref={videoRef}
        src={item.url}
        className={className}
        muted
        playsInline
        preload="auto"
        loop={loop && active}
        aria-hidden={!active}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.url} alt="" className={className} aria-hidden={!active} />
  );
}

function overlayStateKey(trivia: TriviaWallState | null, audience: AudienceWallState | null) {
  return JSON.stringify({ trivia, audience });
}
