"use client";

import { useEffect, useState, useTransition } from "react";
import { Music2Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { toast } from "sonner";
import {
  listStationPublishedPerformancesAction,
  pauseStationPerformanceAction,
  playStationPublishedPerformanceAction,
  resumeStationPerformanceAction,
  seekStationPerformanceRelativeAction,
  setStationPerformanceMutedAction,
  setStationPerformanceVolumeAction,
  stopStationPerformanceAction,
} from "@/actions/server-station-performances";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import type { PublishedStationPerformance } from "@/lib/queries/performance-library";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

const VOLUME_PRESETS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
] as const;

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ServerStationPerformances({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  const [items, setItems] = useState<PublishedStationPerformance[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  function reload() {
    startTransition(async () => {
      const result = await listStationPublishedPerformancesAction();
      if (!result.ok) {
        setLoadError(result.message);
        setItems([]);
        return;
      }
      setLoadError(null);
      setItems(result.performances || []);
    });
  }

  useEffect(() => {
    reload();
    const timer = window.setInterval(() => reload(), 12_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(action: () => Promise<{ ok: boolean; message: string }>, onOk?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        onOk?.();
      } else toast.error(result.message);
      reload();
    });
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="Performances">
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">Performances</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          Shows published from the Performance Library. Playing one takes over the LED wall with audio on until you
          stop or mute.
        </p>
      </div>

      <div className="mb-4 space-y-3 rounded-[28px] border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ServerStationButton
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => pauseStationPerformanceAction())}
          >
            Pause
          </ServerStationButton>
          <ServerStationButton
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => resumeStationPerformanceAction())}
          >
            Resume
          </ServerStationButton>
          <ServerStationButton
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => seekStationPerformanceRelativeAction(-15))}
          >
            −15s
          </ServerStationButton>
          <ServerStationButton
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => seekStationPerformanceRelativeAction(15))}
          >
            +15s
          </ServerStationButton>
          <ServerStationButton
            variant="danger"
            disabled={pending}
            onClick={() => run(() => stopStationPerformanceAction())}
          >
            Stop &amp; return to normal
          </ServerStationButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <p className="mr-1 flex items-center gap-2 text-sm font-semibold tracking-wide text-[#e8d5c4] uppercase">
            {muted ? <VolumeXIcon className="h-4 w-4" aria-hidden /> : <Volume2Icon className="h-4 w-4" aria-hidden />}
            Audio
          </p>
          <ServerStationButton
            variant={muted ? "primary" : "secondary"}
            disabled={pending}
            onClick={() =>
              run(
                () => setStationPerformanceMutedAction(!muted),
                () => setMuted(!muted),
              )
            }
          >
            {muted ? "Unmute" : "Mute"}
          </ServerStationButton>
          {VOLUME_PRESETS.map((preset) => {
            const active = !muted && Math.abs(volume - preset.value) < 0.01;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setStationPerformanceVolumeAction({ volume: preset.value }),
                    () => {
                      setVolume(preset.value);
                      setMuted(false);
                    },
                  )
                }
                className={cn(
                  "min-h-12 min-w-16 rounded-2xl border px-3 text-base font-semibold transition",
                  active
                    ? "border-[#f0c27a] bg-[#f0c27a] text-[#1a120c]"
                    : "border-white/15 bg-black/30 text-[#f7efe6] hover:border-white/30",
                  pending && "opacity-60",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {loadError ? (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-5 text-lg text-[#f7efe6]">
          {loadError}
        </p>
      ) : null}

      <div className="space-y-3">
        {!loadError && items.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-lg text-[#e8d5c4]">
            No performances published yet. Ask a manager to publish sessions from Screens → Performance Library.
          </p>
        ) : null}

        {items.map((item) => {
          const ready = item.availability === "ready" || item.availability === "metadata-only";
          const duration = formatDuration(item.duration_seconds);
          return (
            <article
              key={item.id}
              className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex h-20 w-full items-center justify-center rounded-2xl bg-black/50 sm:w-28">
                <Music2Icon className="h-8 w-8 text-[#e8d5c4]/70" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xl font-bold text-[#f7efe6]">{item.title}</p>
                <p className="text-sm text-[#e8d5c4]/90">{formatWhen(item.parsed_timestamp)}</p>
                <p className="text-sm text-[#e8d5c4]/70">
                  {item.availability}
                  {duration ? ` · ${duration}` : ""}
                  {item.camera_count > 0
                    ? ` · ${item.camera_count} camera${item.camera_count === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
              <div className="sm:ml-auto">
                <ServerStationButton
                  disabled={pending || !ready}
                  onClick={() =>
                    run(
                      () => playStationPublishedPerformanceAction({ recordingRowId: item.id }),
                      () => {
                        setMuted(false);
                        setVolume(1);
                      },
                    )
                  }
                >
                  {ready ? "Play on wall" : "Not ready"}
                </ServerStationButton>
              </div>
            </article>
          );
        })}
      </div>
    </ServerStationShell>
  );
}
