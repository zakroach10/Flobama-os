"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addToQueueAction,
  pausePerformanceAction,
  playNextAction,
  playNowAction,
  prepareRecordingAction,
  resumePerformanceAction,
  scanPerformanceLibraryAction,
  setPerformanceAudioMutedAction,
  setRecordingsRootAction,
  skipPerformanceAction,
  stopReturnToNormalWallAction,
  updateRecordingMatchAction,
  updateRecordingTitleAction,
} from "@/actions/performance-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERFORMANCE_LIBRARY_SQL } from "@/lib/constants";
import type { StaffPerformanceRecording } from "@/lib/queries/performance-library";
import { isDisplayDeviceStale, type StaffDisplayDevice } from "@/lib/display-devices/types";

function formatBytes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatClock(iso: string | null | undefined) {
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

type PlaybackState = {
  mode: string;
  audio_muted: boolean;
  now_playing_title: string | null;
  now_playing_recording_id: string | null;
  position_seconds: number | null;
  duration_seconds: number | null;
  paused: boolean;
  status: string | null;
  last_error: string | null;
} | null;

type Settings = {
  recordings_root: string | null;
  last_scan_at: string | null;
  catalog_count: number;
  last_catalog_sync_at: string | null;
} | null;

export function PerformanceLibraryPanel({
  recordings,
  missingTable,
  listError = null,
  settings,
  playback,
  ledRunner,
  canConfigure,
  canPlayback,
}: {
  recordings: StaffPerformanceRecording[];
  missingTable: boolean;
  listError?: string | null;
  settings: Settings;
  playback: PlaybackState;
  ledRunner: StaffDisplayDevice | null;
  canConfigure: boolean;
  canPlayback: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "matched" | "needs_review" | "ready" | "needs download">("all");
  const [rootInput, setRootInput] = useState(settings?.recordings_root || "");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [eventDraft, setEventDraft] = useState<Record<string, string>>({});

  const deviceOffline = !ledRunner || isDisplayDeviceStale(ledRunner.last_seen_at);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recordings.filter((row) => {
      if (filter === "matched" && row.match_status !== "matched" && row.match_status !== "manual") return false;
      if (filter === "needs_review" && row.match_status !== "needs_review") return false;
      if (filter === "ready" && row.availability !== "ready") return false;
      if (filter === "needs download" && row.availability !== "needs download") return false;
      if (!q) return true;
      const hay = `${row.display_title || ""} ${row.original_filename} ${row.relative_path} ${row.events?.title || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [recordings, query, filter]);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });
  }

  if (missingTable) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Performance Library</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Apply <code className="text-xs">{PERFORMANCE_LIBRARY_SQL}</code> in the Supabase SQL editor, then reload
          Screens.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Performance Library</h2>
        <p className="text-sm text-muted-foreground">
          Catalog Dropbox-synced recordings on the wall Mac, match them to historical events, and queue them for LED
          playback. The runner opens every nested session folder and keeps Ecamm program recordings (Ecamm in the
          filename or folder) — Camera A/B angle views are skipped. Media bytes stay on the Local Runner (
          <code className="text-xs">127.0.0.1:4173</code>), never through Vercel.
        </p>
      </div>

      {listError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Could not load catalog: {listError}
        </p>
      ) : null}

      <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div className="font-medium">Recordings folder</div>
          <div className="text-muted-foreground break-all">{settings?.recordings_root || "Not configured on the Mac yet"}</div>
          <div className="text-xs text-muted-foreground">
            Last scan: {formatClock(settings?.last_scan_at)} · {settings?.catalog_count ?? 0} catalogued
            {typeof (settings as { scan_stats?: { skippedCameraOrNonEcamm?: number; videoFiles?: number; totalFiles?: number } } | null)?.scan_stats
              ?.totalFiles === "number"
              ? ` · scanned ${
                  (settings as { scan_stats?: { totalFiles?: number } }).scan_stats?.totalFiles
                } files / ${
                  (settings as { scan_stats?: { videoFiles?: number } }).scan_stats?.videoFiles ?? 0
                } Ecamm`
              : ""}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Local Runner</div>
          <div className={deviceOffline ? "text-destructive" : "text-muted-foreground"}>
            {deviceOffline ? "Device offline or stale" : ledRunner?.label || "Paired"}
          </div>
          <div className="text-xs text-muted-foreground">
            Playback: {playback?.mode === "performance" ? "Performance mode" : "Normal wall"}
            {playback?.audio_muted === false ? " · Audio ON" : " · Audio muted"}
          </div>
        </div>
      </div>

      {canConfigure ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData();
            fd.set("recordingsRoot", rootInput);
            run(() => setRecordingsRootAction(fd));
          }}
        >
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium" htmlFor="recordings-root">
              Set recordings root on Mac
            </label>
            <Input
              id="recordings-root"
              value={rootInput}
              onChange={(e) => setRootInput(e.target.value)}
              placeholder="/Users/…/Dropbox/…/Recordings"
            />
          </div>
          <Button type="submit" disabled={pending || !rootInput.trim()}>
            Save path
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => scanPerformanceLibraryAction())}>
            Rescan
          </Button>
        </form>
      ) : null}

      {playback?.mode === "performance" ? (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="text-sm font-medium">Now playing</div>
          <div className="text-sm">{playback.now_playing_title || playback.now_playing_recording_id || "—"}</div>
          <div className="text-xs text-muted-foreground">
            {playback.paused ? "Paused" : playback.status || "Playing"}
            {playback.position_seconds != null
              ? ` · ${Math.floor(playback.position_seconds)}s` +
                (playback.duration_seconds ? ` / ${Math.floor(playback.duration_seconds)}s` : "")
              : ""}
            {playback.last_error ? ` · Error: ${playback.last_error}` : ""}
          </div>
          {canPlayback ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => (playback.paused ? resumePerformanceAction() : pausePerformanceAction()))}>
                {playback.paused ? "Resume" : "Pause"}
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => skipPerformanceAction())}>
                Skip
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => setPerformanceAudioMutedAction(!(playback.audio_muted === false)))}
              >
                {playback.audio_muted === false ? "Mute audio" : "Enable audio"}
              </Button>
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => stopReturnToNormalWallAction())}>
                Stop &amp; return to normal wall
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artist, event, title, filename…"
          className="sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", "All"],
              ["matched", "Matched"],
              ["needs_review", "Needs review"],
              ["ready", "Ready"],
              ["needs download", "Needs download"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>No recordings in this view yet.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Apply the performance library SQL migration in Supabase if the panel asked you to.</li>
              <li>Install Local Runner 1.1.2+ on the wall Mac and keep it online.</li>
              <li>
                Set the Recordings root to the Dropbox <code className="text-xs">…/Recordings</code> folder (the one
                that contains the Ecamm session folders), then click Rescan.
              </li>
              <li>
                Or on the Mac:{" "}
                <code className="text-xs">node index.mjs --inventory-recordings --export=~/Desktop/performance-inventory.json</code>
              </li>
            </ol>
          </div>
        ) : (
          filtered.slice(0, 100).map((row) => (
            <article key={row.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="font-medium leading-snug">{row.display_title || row.original_filename}</div>
                  <div className="text-xs text-muted-foreground break-all">{row.original_filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.match_status.replace("_", " ")}
                    {row.match_reason ? ` · ${row.match_reason}` : ""}
                    {" · "}
                    {row.availability}
                    {" · "}
                    {formatBytes(row.file_size)}
                    {" · "}
                    {formatClock(row.parsed_timestamp)}
                  </div>
                  {row.events ? (
                    <div className="text-xs">Event: {row.events.title}</div>
                  ) : row.suggested_event_ids?.length ? (
                    <div className="text-xs text-muted-foreground">
                      Suggested candidates: {row.suggested_event_ids.length}
                    </div>
                  ) : null}
                </div>
                {canPlayback ? (
                  <div className="flex flex-wrap gap-1">
                    {row.availability !== "ready" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending || deviceOffline}
                        onClick={() => run(() => prepareRecordingAction(row.recording_id))}
                      >
                        Prepare for playback
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={pending || deviceOffline || row.availability !== "ready"}
                      onClick={() => run(() => playNowAction(row.recording_id, row.display_title))}
                    >
                      Play now
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending || deviceOffline || row.availability !== "ready"}
                      onClick={() => run(() => playNextAction(row.recording_id, row.display_title))}
                    >
                      Play next
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || deviceOffline || row.availability !== "ready"}
                      onClick={() => run(() => addToQueueAction(row.recording_id, row.display_title))}
                    >
                      Add to queue
                    </Button>
                  </div>
                ) : null}
              </div>

              {canConfigure ? (
                <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row">
                  {editingTitleId === row.id ? (
                    <>
                      <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="sm:max-w-md" />
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            const result = await updateRecordingTitleAction({
                              recordingRowId: row.id,
                              displayTitle: titleDraft,
                              lock: true,
                            });
                            if (result.ok) setEditingTitleId(null);
                            return result;
                          })
                        }
                      >
                        Save title
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTitleId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingTitleId(row.id);
                        setTitleDraft(row.display_title || "");
                      }}
                    >
                      Edit display title
                    </Button>
                  )}
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <Input
                      placeholder="Event UUID to assign"
                      value={eventDraft[row.id] || row.matched_event_id || ""}
                      onChange={(e) => setEventDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      className="sm:max-w-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          updateRecordingMatchAction({
                            recordingRowId: row.id,
                            eventId: (eventDraft[row.id] || row.matched_event_id || "").trim() || null,
                            lock: true,
                          }),
                        )
                      }
                    >
                      Lock event match
                    </Button>
                  </div>
                </div>
              ) : null}

              {row.availability === "needs download" ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Online-only in Dropbox. On the Mac: right-click the file → Make available offline, then Prepare for
                  playback.
                </p>
              ) : null}
            </article>
          ))
        )}
        {filtered.length > 100 ? (
          <p className="text-xs text-muted-foreground">Showing first 100 of {filtered.length}. Refine search to narrow.</p>
        ) : null}
      </div>
    </section>
  );
}
