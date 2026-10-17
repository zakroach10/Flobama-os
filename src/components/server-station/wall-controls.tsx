"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { activateServerStationSceneAction } from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import type {
  ServerStationPlaylistCard,
  ServerStationSceneCard,
} from "@/lib/server-station/scenes";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

function ScenePreview({ scene }: { scene: ServerStationSceneCard }) {
  const url = scene.preview_url;
  if (url && scene.media_kind === "video") {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-28 w-full object-cover"
      />
    );
  }
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-28 w-full object-cover" loading="lazy" decoding="async" />
    );
  }
  if (scene.kind === "obs") {
    return (
      <div className="flex h-28 flex-col items-center justify-center gap-1 bg-white/5 px-3 text-center text-[#e8d5c4]">
        <span className="text-xs font-semibold tracking-[0.16em] uppercase opacity-70">OBS</span>
        <span className="line-clamp-2 text-sm font-medium">{scene.obs_scene_name || scene.title}</span>
      </div>
    );
  }
  return (
    <div className="flex h-28 items-center justify-center bg-white/5 text-[#e8d5c4]">Scene</div>
  );
}

export function ServerStationWallControls({
  actorName,
  wall,
  initialScenes,
  initialPlaylists,
  initialDefaultPlaylistId,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  initialScenes: ServerStationSceneCard[];
  initialPlaylists: ServerStationPlaylistCard[];
  initialDefaultPlaylistId: string | null;
}) {
  const [scenes] = useState(initialScenes);
  const [playlists] = useState(initialPlaylists);
  const [defaultPlaylistId] = useState(initialDefaultPlaylistId);
  const [confirm, setConfirm] = useState<{ label: string; payload: Record<string, unknown> } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(payload: Record<string, unknown>) {
    startTransition(async () => {
      const result = await activateServerStationSceneAction(payload);
      setConfirm(null);
      setMessage(result.message);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="LED Wall Controls">
      <div className="mb-5 space-y-2">
        <h1 className="text-3xl font-bold text-[#f7efe6]">Change the wall</h1>
        <p className="text-lg text-[#e8d5c4]/90">
          Only scenes approved by a manager appear here. Temporary changes do not turn off automatic band graphics.
        </p>
      </div>

      {!wall.connected && wall.offlineReason ? (
        <p className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-50">
          {wall.offlineReason}
        </p>
      ) : null}
      {message ? (
        <p className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-50">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending || !defaultPlaylistId}
          onClick={() =>
            setConfirm({
              label: "House Ads / normal rotation",
              payload: { resumeNormal: true },
            })
          }
          className="min-h-[140px] rounded-[28px] border border-[#d36b4a]/40 bg-gradient-to-br from-[#d36b4a]/25 to-transparent p-6 text-left disabled:opacity-40"
        >
          <p className="text-2xl font-bold text-[#f7efe6]">Resume Normal Rotation</p>
          <p className="mt-2 text-[#e8d5c4]">Return to house ads and scheduled programming.</p>
        </button>

        {defaultPlaylistId ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              setConfirm({
                label: "House Ads",
                payload: { playlistId: defaultPlaylistId },
              })
            }
            className="min-h-[140px] rounded-[28px] border border-white/15 bg-black/25 p-6 text-left disabled:opacity-40"
          >
            <p className="text-2xl font-bold text-[#f7efe6]">House Ads</p>
            <p className="mt-2 text-[#e8d5c4]">Play the default advertising playlist.</p>
          </button>
        ) : null}

        {playlists
          .filter((playlist) => playlist.id !== defaultPlaylistId)
          .slice(0, 4)
          .map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  label: playlist.name,
                  payload: { playlistId: playlist.id },
                })
              }
              className="min-h-[140px] rounded-[28px] border border-white/15 bg-black/25 p-6 text-left disabled:opacity-40"
            >
              <p className="text-2xl font-bold text-[#f7efe6]">{playlist.name}</p>
              <p className="mt-2 text-[#e8d5c4]">Approved playlist</p>
            </button>
          ))}

        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            disabled={pending}
            onClick={() =>
              setConfirm({
                label: scene.title,
                payload: { sceneId: scene.id },
              })
            }
            className="min-h-[140px] overflow-hidden rounded-[28px] border border-white/15 bg-black/25 text-left disabled:opacity-40"
          >
            <ScenePreview scene={scene} />
            <div className="p-5">
              <p className="text-xl font-bold text-[#f7efe6]">{scene.title}</p>
              <p className="mt-1 text-sm text-[#e8d5c4]">Approved scene</p>
            </div>
          </button>
        ))}
      </div>

      {!scenes.length ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-[#e8d5c4]">
          No scenes are marked for servers yet. Ask an admin to approve scenes in Settings → Server Station.
        </p>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-[28px] border border-white/15 bg-[#1a1613] p-6">
            <h2 className="text-2xl font-bold text-[#f7efe6]">Switch LED wall to {confirm.label}?</h2>
            <p className="mt-2 text-[#e8d5c4]">This updates the live wall once the command is accepted.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ServerStationButton variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </ServerStationButton>
              <ServerStationButton disabled={pending} onClick={() => run(confirm.payload)}>
                Change Wall
              </ServerStationButton>
            </div>
          </div>
        </div>
      ) : null}
    </ServerStationShell>
  );
}
