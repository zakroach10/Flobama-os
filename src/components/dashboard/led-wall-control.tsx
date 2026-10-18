"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activateLedWallSceneAction } from "@/actions/led-wall";
import { getLedRunnerLinkAction, requestDisplaySafeRefreshAction } from "@/actions/display-devices";
import { Button } from "@/components/ui/button";

export type DashboardLedScene = {
  id: string;
  title: string;
  detail: string;
};

export type DashboardRunnerStatus = {
  online: boolean;
  label: string;
  deviceId: string | null;
  programScene: string | null;
  pendingDownloads: number;
};

const PAGE_SIZE = 9;

export function LedWallControl({
  scenes,
  activeSceneId,
  runner,
  canPushUpdate,
  setupHref,
}: {
  scenes: DashboardLedScene[];
  activeSceneId: string | null;
  runner: DashboardRunnerStatus;
  canPushUpdate: boolean;
  setupHref: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [link, setLink] = useState(runner);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLink(runner);
  }, [runner]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void getLedRunnerLinkAction().then((next) => {
        if (next) setLink(next);
      });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, []);
  const pageCount = Math.max(1, Math.ceil(scenes.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = scenes.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function activate(sceneId: string) {
    setPendingId(sceneId);
    startTransition(async () => {
      const result = await activateLedWallSceneAction({ sceneId });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function pushUpdate() {
    if (!link.deviceId) return;
    const deviceId = link.deviceId;
    setPendingId("push");
    startTransition(async () => {
      const result = await requestDisplaySafeRefreshAction({ deviceId });
      setPendingId(null);
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">LED wall</h2>
          <p className={`truncate text-sm ${link.online ? "text-emerald-700" : "text-amber-700"}`}>
            {link.label}
          </p>
        </div>
        {canPushUpdate ? (
          <Button type="button" size="sm" disabled={pendingId !== null || !link.deviceId} onClick={pushUpdate}>
            {pendingId === "push" ? "Pushing…" : "Push update"}
          </Button>
        ) : null}
        {setupHref ? (
          <Button variant="outline" size="sm" render={<Link href={setupHref} />}>
            Screens
          </Button>
        ) : null}
      </div>
      {scenes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No scenes are ready yet.</p>
      ) : (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-3 content-start gap-2">
          {visible.map((scene) => {
            const active = scene.id === activeSceneId;
            const pending = pendingId === scene.id;
            return (
              <button
                key={scene.id}
                type="button"
                aria-pressed={active}
                disabled={pendingId !== null || active}
                onClick={() => activate(scene.id)}
                className={
                  active
                    ? "min-h-14 rounded-lg border border-primary bg-primary px-3 py-2 text-left text-primary-foreground"
                    : "min-h-14 rounded-lg border bg-background px-3 py-2 text-left hover:bg-muted disabled:opacity-60"
                }
              >
                <span className="block truncate text-sm font-medium">{scene.title}</span>
                <span className={`mt-0.5 block truncate text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {pending ? "Sending…" : active ? "On the wall" : scene.detail}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {pageCount > 1 ? (
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}
