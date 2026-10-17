"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  extendServerStationItemAction,
  listActiveServerStationItemsAction,
  removeServerStationItemAction,
} from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

type Item = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  status: string;
  thumbnail_url: string | null;
  created_by_name: string | null;
  ends_at: string;
  show_now: boolean;
};

export function ServerStationActiveItems({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const result = await listActiveServerStationItemsAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setItems(result.items as Item[]);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="Active on Wall">
      <div className="mb-5 space-y-2">
        <h1 className="text-3xl font-bold text-[#f7efe6]">Temporary slides</h1>
        <p className="text-lg text-[#e8d5c4]/90">
          Only Server Station content appears here. House ads and manager media stay protected.
        </p>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-lg text-[#e8d5c4]">
            Nothing temporary is active right now.
          </p>
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center"
          >
            <div className="h-28 w-full overflow-hidden rounded-2xl bg-black/40 sm:w-44">
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-[#f7efe6]">{item.title}</p>
              <p className="text-sm text-[#e8d5c4]">
                {item.created_by_name || "Staff"} · {item.status}
                {item.show_now ? " · showing now" : ""}
              </p>
              <p className="text-sm text-[#e8d5c4]/80">
                Expires {new Date(item.ends_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ServerStationButton
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await extendServerStationItemAction({
                      itemId: item.id,
                      durationPreset: 15,
                    });
                    if (result.ok) {
                      toast.success(result.message);
                      reload();
                    } else toast.error(result.message);
                  });
                }}
              >
                Extend 15m
              </ServerStationButton>
              <ServerStationButton
                variant="danger"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await removeServerStationItemAction({ itemId: item.id });
                    if (result.ok) {
                      toast.success(result.message);
                      reload();
                    } else toast.error(result.message);
                  });
                }}
              >
                Remove From Rotation
              </ServerStationButton>
            </div>
          </div>
        ))}
      </div>
    </ServerStationShell>
  );
}
