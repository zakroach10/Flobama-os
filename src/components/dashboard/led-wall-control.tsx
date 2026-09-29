"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activateLedWallSceneAction } from "@/actions/led-wall";
import { Button } from "@/components/ui/button";

export type DashboardLedScene = {
  id: string;
  title: string;
  detail: string;
};

export function LedWallControl({
  scenes,
  activeSceneId,
  status,
  setupHref,
}: {
  scenes: DashboardLedScene[];
  activeSceneId: string | null;
  status: string;
  setupHref: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">LED wall</h2>
          <p className="text-sm text-muted-foreground">Put a scene on the wall. The booth client switches OBS.</p>
        </div>
        {setupHref ? (
          <Button variant="outline" render={<Link href={setupHref} />}>
            Scene setup
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{status}</p>
      {scenes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scenes are ready yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene) => {
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
                    ? "min-h-16 rounded-lg border border-primary bg-primary px-4 py-3 text-left text-primary-foreground"
                    : "min-h-16 rounded-lg border bg-background px-4 py-3 text-left hover:bg-muted disabled:opacity-60"
                }
              >
                <span className="block font-medium">{scene.title}</span>
                <span className={`mt-0.5 block text-sm ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {pending ? "Putting it on the wall…" : active ? "On the wall" : scene.detail}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
