"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { pinLedPreloadAction, readLedPreloadStatusAction, unpinLedPreloadAction } from "@/actions/led-preload";
import { Button } from "@/components/ui/button";
import { LED_PRELOAD_LEAD_MS, type PreloadReportState } from "@/lib/screens/led-preload";

export type PreloadSceneChoice = {
  id: string;
  title: string;
  mediaKind: "image" | "video";
};

const LEAD_MINUTES = LED_PRELOAD_LEAD_MS / 60_000;

function statusLabel(state: PreloadReportState | null) {
  if (state === "ready") return "Ready on the wall";
  if (state === "loading") return "Loading on the wall";
  if (state === "error") return "Wall could not load it";
  return "Not reported yet";
}

export function LedPreloadPanel({
  scenes,
  pinnedIds,
  reports,
  missingTable,
}: {
  scenes: PreloadSceneChoice[];
  pinnedIds: string[];
  reports: Record<string, { state: PreloadReportState; message: string | null }>;
  missingTable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [polledReports, setPolledReports] = useState<typeof reports | null>(null);
  const liveReports = polledReports ?? reports;
  const pinned = new Set(pinnedIds);

  useEffect(() => {
    if (missingTable) return;
    const timer = window.setInterval(() => {
      void readLedPreloadStatusAction().then((result) => {
        if (result.ok) setPolledReports(result.reports);
      });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [missingTable]);

  function pin(sceneId: string, release: boolean) {
    startTransition(async () => {
      const result = release ? await unpinLedPreloadAction({ sceneId }) : await pinLedPreloadAction({ sceneId });
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Preload visuals</h2>
        <p className="text-sm text-muted-foreground">
          The wall browser decodes image and video files before they go live. Today’s shows start warming{" "}
          {LEAD_MINUTES} minutes before showtime. Preload does not change what is on the wall. Auto-roll still waits
          until its own window, and Put on wall is unchanged.
        </p>
      </div>
      {missingTable ? (
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">supabase/migrations/20261107000066_led_wall_preload.sql</code> to pin extra
          visuals and to store booth ready/loading/error reports. Scheduled warming still runs on the wall browser
          without that file.
        </p>
      ) : null}
      {scenes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No image or video visuals to preload yet.</p>
      ) : (
        <ul className="space-y-2">
          {scenes.map((scene) => {
            const report = liveReports[scene.id] ?? null;
            const isPinned = pinned.has(scene.id);
            return (
              <li
                key={scene.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{scene.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {scene.mediaKind === "video" ? "Video" : "Image"}
                    {isPinned ? " · pinned" : ""}
                    {" · "}
                    {statusLabel(report?.state ?? null)}
                    {report?.state === "error" && report.message ? ` · ${report.message}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isPinned ? "outline" : "default"}
                  disabled={pending || missingTable}
                  onClick={() => pin(scene.id, isPinned)}
                >
                  {isPinned ? "Release" : "Preload"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
