import type { PublicLedMedia } from "@/lib/screens/led-wall";

/** Playback position close enough to the end that the wall should wrap. */
export function videoNearsEnd(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return false;
  // Opening frames must not wrap again immediately after a restart.
  if (currentTime < 0.25) return false;
  const lead = Math.min(0.35, Math.max(0.05, duration * 0.02));
  return currentTime >= duration - lead;
}

export function samePublicLedMedia(current: PublicLedMedia | null, next: PublicLedMedia | null) {
  if (!current || !next) return current === next;
  return current.id === next.id && current.url === next.url && current.mediaKind === next.mediaKind;
}

type RestartableVideo = {
  currentTime: number;
  seekable: { length: number };
  loop: boolean;
  load: () => void;
  play: () => Promise<void> | void;
  addEventListener: (type: "loadeddata", listener: () => void, options?: { once?: boolean }) => void;
};

/**
 * OBS Browser Source ignores the HTML loop attribute and freezes on the last frame.
 * Seek to the start when the file allows it. Otherwise reload, which is what a
 * non-faststart MP4 needs after it has played through once.
 */
export function restartLedVideo(video: RestartableVideo) {
  video.loop = true;
  const play = () => {
    try {
      const pending = video.play();
      if (pending && typeof pending.catch === "function") void pending.catch(() => undefined);
    } catch {
      // The element can be gone between the end of the clip and play().
    }
  };

  if (video.seekable.length > 0) {
    try {
      video.currentTime = 0;
    } catch {
      // Not seekable yet.
    }
    if (video.currentTime <= 0.05) {
      play();
      return;
    }
  }

  video.addEventListener("loadeddata", () => play(), { once: true });
  video.load();
}
