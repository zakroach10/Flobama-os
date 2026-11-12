"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { cameraErrorMessage, openBoothCamera } from "@/components/photo-booth/camera";
import { createDemoStream } from "@/components/photo-booth/demo-stream";
import {
  PHOTO_BOOTH_CAMERA_STORAGE_KEY,
  PHOTO_BOOTH_COUNTDOWN_SECONDS,
  PHOTO_BOOTH_HEIGHT,
  PHOTO_BOOTH_IMAGE_HEIGHT,
  PHOTO_BOOTH_MAX_BYTES,
  PHOTO_BOOTH_WIDTH,
  photoBoothIdleMs,
} from "@/lib/photo-booth/constants";
import { drawMirroredCover, drawPhotoBoothStill } from "@/lib/photo-booth/draw";
import { formatPhotoBoothWhen, sanitizePhotoBoothLabel, type CameraCandidate } from "@/lib/photo-booth/frame";
import type { PublicEventJson } from "@/lib/public/listings";

type Phase = "attract" | "preview" | "countdown" | "review" | "saving" | "share" | "error";

export function PhotoBoothKiosk({ demo = false }: { demo?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stillBlobRef = useRef<Blob | null>(null);
  const stillUrlRef = useRef<string | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const runRef = useRef(0);
  const phaseRef = useRef<Phase>("attract");
  const deadlineRef = useRef(0);
  const wakeRequested = useRef(false);

  const [phase, setPhaseState] = useState<Phase>("attract");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventLabel, setEventLabel] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraCandidate[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const enter = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
    if (next === "preview" || next === "review" || next === "share" || next === "error") {
      const idleMs = photoBoothIdleMs(next);
      deadlineRef.current = Date.now() + idleMs;
      setSecondsLeft(Math.ceil(idleMs / 1000));
    }
  }, []);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const clearStill = useCallback(() => {
    if (stillUrlRef.current) URL.revokeObjectURL(stillUrlRef.current);
    stillUrlRef.current = null;
    stillBlobRef.current = null;
    setStillUrl(null);
  }, []);

  const goAttract = useCallback(() => {
    runRef.current += 1;
    stopStream();
    clearStill();
    setPickerOpen(false);
    setCount(null);
    setMessage(null);
    setQrUrl(null);
    setFlash(false);
    enter("attract");
  }, [clearStill, enter, stopStream]);

  useEffect(() => {
    const image = new Image();
    image.src = "/flobama-logo.png?v=2";
    image.onload = () => {
      logoRef.current = image;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/v1/now", { cache: "no-store" })
      .then((response) => response.json())
      .then((json: { nowPlaying?: PublicEventJson | null; today?: PublicEventJson[] }) => {
        if (cancelled) return;
        const live = json.nowPlaying ?? happeningNow(json.today ?? []);
        setEventLabel(sanitizePhotoBoothLabel(live?.name));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      stopStream();
      if (stillUrlRef.current) URL.revokeObjectURL(stillUrlRef.current);
    };
  }, [stopStream]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), 180);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (phase !== "preview" && phase !== "countdown") return;
    let raf = 0;
    const loop = () => {
      const video = videoRef.current;
      const canvas = previewRef.current;
      const ctx = canvas?.getContext("2d");
      if (video && canvas && ctx && video.videoWidth > 0) {
        drawMirroredCover(ctx, video, video.videoWidth, video.videoHeight, canvas.width, canvas.height);
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== "preview" && phase !== "review" && phase !== "share" && phase !== "error") return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(timer);
        goAttract();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [goAttract, phase]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && wakeRequested.current) {
        void navigator.wakeLock?.request("screen").catch(() => undefined);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  function engageKiosk() {
    wakeRequested.current = true;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
    void navigator.wakeLock?.request("screen").catch(() => undefined);
  }

  async function attachStream(stream: MediaStream, devices: CameraCandidate[], deviceId: string | null) {
    stopStream();
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) throw new Error("Camera preview is not ready.");
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "true");
    await video.play();
    setCameras(devices);
    setActiveCameraId(deviceId);
  }

  async function startPreview(preferredId?: string | null) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    engageKiosk();
    try {
      if (demo) {
        await attachStream(createDemoStream(), [{ deviceId: "demo", label: "Demo camera" }], "demo");
      } else {
        const saved = preferredId === undefined ? readSavedCamera() : preferredId;
        const opened = await openBoothCamera(saved);
        await attachStream(opened.stream, opened.devices, opened.deviceId);
        if (opened.deviceId) writeSavedCamera(opened.deviceId);
      }
      enter("preview");
    } catch (error) {
      stopStream();
      setMessage(cameraErrorMessage(error));
      enter("error");
    } finally {
      setBusy(false);
    }
  }

  const captureStill = useCallback(async (runId: number) => {
    const video = videoRef.current;
    if (!video) return;
    const ready = await waitForFrame(video);
    if (runRef.current !== runId) return;
    if (!ready) {
      setMessage("The camera didn't send a frame. Try again.");
      enter("preview");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_BOOTH_WIDTH;
    canvas.height = PHOTO_BOOTH_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setMessage("This browser couldn't save the photo.");
      enter("preview");
      return;
    }
    setFlash(true);
    drawPhotoBoothStill(ctx, video, video.videoWidth, video.videoHeight, {
      eventLabel,
      whenLabel: formatPhotoBoothWhen(new Date()),
      logo: logoRef.current
        ? { image: logoRef.current, width: logoRef.current.naturalWidth, height: logoRef.current.naturalHeight }
        : null,
      fontFamily: getComputedStyle(document.body).fontFamily,
    });
    const blob = await canvasToJpeg(canvas);
    if (runRef.current !== runId) return;
    if (!blob) {
      setMessage("That photo was too large to save. Try again.");
      enter("preview");
      return;
    }
    if (stillUrlRef.current) URL.revokeObjectURL(stillUrlRef.current);
    const url = URL.createObjectURL(blob);
    stillUrlRef.current = url;
    stillBlobRef.current = blob;
    setStillUrl(url);
    enter("review");
  }, [enter, eventLabel]);

  const beginCountdown = useCallback(() => {
    if (phaseRef.current !== "preview") return;
    const runId = ++runRef.current;
    enter("countdown");
    setPickerOpen(false);
    void (async () => {
      for (let n = PHOTO_BOOTH_COUNTDOWN_SECONDS; n >= 1; n -= 1) {
        if (runRef.current !== runId) return;
        setCount(n);
        await wait(1000);
      }
      if (runRef.current !== runId) return;
      setCount(null);
      await captureStill(runId);
    })();
  }, [captureStill, enter]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        goAttract();
        return;
      }
      if ((event.key === " " || event.key === "Enter") && phaseRef.current === "preview" && !pickerOpen) {
        event.preventDefault();
        beginCountdown();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beginCountdown, goAttract, pickerOpen]);

  async function keepPhoto() {
    const blob = stillBlobRef.current;
    if (!blob || phaseRef.current !== "review") return;
    enter("saving");
    setMessage(null);
    try {
      const form = new FormData();
      form.set("photo", blob, "flobama.jpg");
      if (eventLabel) form.set("eventLabel", eventLabel);
      const response = await fetch("/api/public/v1/photo-booth", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      const json = (await response.json()) as { error?: string; shareUrl?: string };
      if (!response.ok || !json.shareUrl) {
        throw new Error(json.error ?? "Couldn't share that photo.");
      }
      const qr = await QRCode.toDataURL(json.shareUrl, {
        margin: 1,
        width: 640,
        color: { dark: "#14110e", light: "#ffffff" },
      });
      stopStream();
      setQrUrl(qr);
      enter("share");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't share that photo.");
      enter("review");
    }
  }

  function retake() {
    runRef.current += 1;
    clearStill();
    setMessage(null);
    setQrUrl(null);
    if (streamRef.current) {
      enter("preview");
      return;
    }
    void startPreview(activeCameraId);
  }

  async function switchCamera(deviceId: string) {
    setPickerOpen(false);
    writeSavedCamera(deviceId);
    setBusy(true);
    try {
      stopStream();
      const opened = await openBoothCamera(deviceId);
      await attachStream(opened.stream, opened.devices, opened.deviceId);
      if (opened.deviceId) writeSavedCamera(opened.deviceId);
      enter("preview");
    } catch (error) {
      stopStream();
      setMessage(cameraErrorMessage(error));
      enter("error");
    } finally {
      setBusy(false);
    }
  }

  function onActivity() {
    const current = phaseRef.current;
    if (current !== "preview" && current !== "review" && current !== "share") return;
    const idleMs = photoBoothIdleMs(current);
    deadlineRef.current = Date.now() + idleMs;
    setSecondsLeft(Math.ceil(idleMs / 1000));
  }

  const activeLabel =
    cameras.find((camera) => camera.deviceId === activeCameraId)?.label ||
    (cameras.length === 1 ? cameras[0]?.label : "") ||
    (demo ? "Demo camera" : "USB camera");

  return (
    <div
      className="absolute inset-0 flex touch-manipulation flex-col overflow-hidden bg-[#14110e] text-[#f6efe6] select-none"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={onActivity}
    >
      <video ref={videoRef} className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0" playsInline muted autoPlay />

      {phase === "attract" ? (
        <section className="flex h-full flex-col items-center justify-between px-8 py-10 sm:px-12 sm:py-14">
          <p className="text-sm tracking-[0.45em] text-[#e4572e] uppercase">Florence, Alabama</p>
          <div className="flex w-full max-w-xl flex-col items-center text-center">
            <FlobamaLogo className="w-[78%] max-w-md" priority />
            <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-6xl">Photo booth</h1>
            <p className="mt-4 max-w-md text-xl leading-snug text-[#c9b8aa] sm:text-2xl">
              Tap to start. Three seconds, then a code for your phone.
            </p>
            {eventLabel ? (
              <p className="mt-6 text-lg text-[#f0a089] sm:text-xl">Tonight · {eventLabel}</p>
            ) : null}
            {demo ? (
              <p className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm tracking-wide text-[#c9b8aa] uppercase">
                Demo camera — not the Mevo
              </p>
            ) : null}
          </div>
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            <button
              type="button"
              className="min-h-24 w-full rounded-full bg-[#e4572e] px-8 text-3xl font-semibold text-white shadow-lg active:scale-[0.98] disabled:opacity-70"
              disabled={busy}
              onClick={() => void startPreview()}
            >
              {busy ? "Starting camera…" : "Take a photo"}
            </button>
            <p className="text-center text-base text-[#8a7368]">No account. The photo link lasts 48 hours.</p>
          </div>
        </section>
      ) : null}

      {phase === "preview" || phase === "countdown" ? (
        <section className="flex h-full min-h-0 flex-col">
          <div className="relative min-h-0 flex-1">
            <canvas
              ref={previewRef}
              width={PHOTO_BOOTH_WIDTH}
              height={PHOTO_BOOTH_IMAGE_HEIGHT}
              className="h-full w-full object-contain"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center bg-gradient-to-b from-black/70 to-transparent px-6 pt-6 pb-16">
              <FlobamaLogo className="w-40" />
            </div>
            {phase === "countdown" && count ? (
              <div className="absolute inset-0 grid place-items-center bg-black/25" aria-live="assertive">
                <span className="text-[18rem] leading-none font-semibold text-white drop-shadow-lg">{count}</span>
              </div>
            ) : null}
            {flash ? <div className="absolute inset-0 bg-white" /> : null}
          </div>
          <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-6 sm:px-10 sm:py-8">
            <button
              type="button"
              className="min-h-16 justify-self-start rounded-full px-6 text-xl text-[#c9b8aa] active:bg-white/10"
              onClick={goAttract}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-label="Take photo"
              className="grid h-28 w-28 place-items-center rounded-full border-4 border-white bg-white/10 active:scale-95 disabled:opacity-50"
              disabled={phase !== "preview" || busy}
              onClick={beginCountdown}
            >
              <span className="h-20 w-20 rounded-full bg-white" />
            </button>
            <div className="justify-self-end text-right">
              {cameras.length > 1 ? (
                <button
                  type="button"
                  className="min-h-16 rounded-full border border-white/20 px-5 text-lg active:bg-white/10"
                  onClick={() => setPickerOpen(true)}
                >
                  Camera
                </button>
              ) : (
                <p className="max-w-40 text-sm leading-snug text-[#8a7368]">{activeLabel}</p>
              )}
            </div>
          </footer>
        </section>
      ) : null}

      {phase === "review" || phase === "saving" ? (
        <section className="flex h-full min-h-0 flex-col px-6 py-6 sm:px-10 sm:py-8">
          <div className="min-h-0 flex-1">
            {stillUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stillUrl} alt="Your photo, ready to keep or retake" className="h-full w-full object-contain" />
            ) : null}
          </div>
          {message ? <p className="mt-3 text-center text-lg text-[#f0a089]">{message}</p> : null}
          <p className="mt-3 text-center text-base text-[#8a7368]">
            {phase === "saving" ? "Saving…" : `Back to the start in ${formatRemain(secondsLeft)}`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <button
              type="button"
              className="min-h-20 rounded-3xl border border-white/20 text-2xl active:bg-white/10 disabled:opacity-50"
              disabled={phase === "saving"}
              onClick={retake}
            >
              Retake
            </button>
            <button
              type="button"
              className="min-h-20 rounded-3xl bg-[#e4572e] text-2xl font-semibold text-white active:scale-[0.98] disabled:opacity-60"
              disabled={phase === "saving"}
              onClick={() => void keepPhoto()}
            >
              {phase === "saving" ? "Saving…" : "Keep it"}
            </button>
          </div>
        </section>
      ) : null}

      {phase === "share" ? (
        <section className="flex h-full min-h-0 flex-col items-center justify-between px-6 py-8 sm:px-10">
          <FlobamaLogo className="w-40" />
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6">
            <div className="text-center">
              <h2 className="text-4xl font-semibold sm:text-5xl">Scan to keep it</h2>
              <p className="mt-3 text-xl text-[#c9b8aa]">No app. No account. Deleted after 48 hours.</p>
            </div>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR code to open this photo on your phone" className="h-auto max-h-[min(46vh,440px)] w-[min(72vw,440px)] rounded-3xl bg-white p-4" />
            ) : null}
            {stillUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stillUrl} alt="" className="max-h-40 rounded-2xl object-contain" />
            ) : null}
          </div>
          <div className="flex w-full max-w-md flex-col items-center gap-3">
            <p className="text-base text-[#8a7368]">Back to the start in {formatRemain(secondsLeft)}</p>
            <button
              type="button"
              className="min-h-20 w-full rounded-full border border-white/20 text-2xl active:bg-white/10"
              onClick={goAttract}
            >
              Done
            </button>
          </div>
        </section>
      ) : null}

      {phase === "error" ? (
        <section className="flex h-full flex-col items-center justify-center gap-8 px-8 text-center">
          <FlobamaLogo className="w-48" />
          <h2 className="text-4xl font-semibold">Camera needed</h2>
          <p className="max-w-lg text-2xl leading-snug text-[#c9b8aa]">{message}</p>
          <button
            type="button"
            className="min-h-20 w-full max-w-md rounded-full bg-[#e4572e] text-2xl font-semibold text-white"
            onClick={() => void startPreview()}
          >
            Try again
          </button>
          <button type="button" className="min-h-16 text-xl text-[#8a7368]" onClick={goAttract}>
            Back to start · {formatRemain(secondsLeft)}
          </button>
        </section>
      ) : null}

      {pickerOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-[#14110e]/96 px-6 py-8">
          <h2 className="text-3xl font-semibold">Choose camera</h2>
          <p className="mt-2 text-lg text-[#c9b8aa]">Pick the Mevo or other USB webcam. This kiosk remembers it.</p>
          <ul className="mt-6 flex flex-1 flex-col gap-3 overflow-auto">
            {cameras.map((camera, index) => (
              <li key={camera.deviceId}>
                <button
                  type="button"
                  className="min-h-20 w-full rounded-3xl border border-white/15 px-5 text-left text-xl active:bg-white/10"
                  onClick={() => void switchCamera(camera.deviceId)}
                >
                  {camera.label || `Camera ${index + 1}`}
                  {camera.deviceId === activeCameraId ? <span className="mt-1 block text-sm text-[#e4572e]">In use</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 min-h-16 rounded-full text-xl text-[#c9b8aa]"
            onClick={() => setPickerOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function happeningNow(events: PublicEventJson[]): PublicEventJson | null {
  const now = new Date().toISOString();
  return events.find((event) => event.startsAt <= now && event.endsAt > now) ?? null;
}

function readSavedCamera() {
  try {
    return window.localStorage.getItem(PHOTO_BOOTH_CAMERA_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSavedCamera(deviceId: string) {
  try {
    window.localStorage.setItem(PHOTO_BOOTH_CAMERA_STORAGE_KEY, deviceId);
  } catch {
    // Private mode can block storage. The booth still runs this visit.
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForFrame(video: HTMLVideoElement) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (video.videoWidth > 0 && video.videoHeight > 0) return true;
    await wait(50);
  }
  return video.videoWidth > 0;
}

async function canvasToJpeg(canvas: HTMLCanvasElement) {
  let quality = 0.86;
  let blob = await toBlob(canvas, quality);
  while (blob && blob.size > PHOTO_BOOTH_MAX_BYTES && quality > 0.52) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    blob = await toBlob(canvas, quality);
  }
  if (!blob || blob.size > PHOTO_BOOTH_MAX_BYTES) return null;
  return blob;
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

function formatRemain(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}
