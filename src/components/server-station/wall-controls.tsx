"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { activateServerStationSceneAction } from "@/actions/server-station";
import {
  ServerStationButton,
  ServerStationField,
  ServerStationShell,
  serverStationInputClass,
} from "@/components/server-station/shell";
import {
  filterServerStationScenes,
  type ServerStationPlaylistCard,
  type ServerStationSceneCard,
} from "@/lib/server-station/scenes";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

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

function SceneButton({
  scene,
  pending,
  onPick,
}: {
  scene: ServerStationSceneCard;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onPick}
      className="min-h-[140px] overflow-hidden rounded-[28px] border border-white/15 bg-black/25 text-left disabled:opacity-40"
    >
      <ScenePreview scene={scene} />
      <div className="p-5">
        <p className="text-xl font-bold text-[#f7efe6]">{scene.title}</p>
        <p className="mt-1 text-sm text-[#e8d5c4]">
          {scene.artist_id ? "Artist graphic" : "Approved scene"}
        </p>
      </div>
    </button>
  );
}

export function ServerStationWallControls({
  actorName,
  wall,
  initialScenes,
  initialArtistScenes,
  initialHouseScenes,
  initialPlaylists,
  initialDefaultPlaylistId,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  initialScenes: ServerStationSceneCard[];
  initialArtistScenes: ServerStationSceneCard[];
  initialHouseScenes: ServerStationSceneCard[];
  initialPlaylists: ServerStationPlaylistCard[];
  initialDefaultPlaylistId: string | null;
}) {
  const [artistScenes] = useState(initialArtistScenes);
  const [houseScenes] = useState(initialHouseScenes.length ? initialHouseScenes : initialScenes.filter((s) => !s.artist_id));
  const [playlists] = useState(initialPlaylists);
  const [defaultPlaylistId] = useState(initialDefaultPlaylistId);
  const [artistQuery, setArtistQuery] = useState("");
  const [artistLetter, setArtistLetter] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ label: string; payload: Record<string, unknown> } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const filteredArtists = useMemo(
    () => filterServerStationScenes(artistScenes, { query: artistQuery, letter: artistLetter }),
    [artistScenes, artistQuery, artistLetter],
  );

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const scene of artistScenes) {
      const first = scene.title.trim().charAt(0).toUpperCase();
      set.add(/^[A-Z]$/.test(first) ? first : "#");
    }
    return set;
  }, [artistScenes]);

  const showArtistResults = Boolean(artistQuery.trim() || artistLetter);

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
          Every artist graphic is available here. Search or tap a letter — no long scrolling.
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

        {houseScenes.map((scene) => (
          <SceneButton
            key={scene.id}
            scene={scene}
            pending={pending}
            onPick={() =>
              setConfirm({
                label: scene.title,
                payload: { sceneId: scene.id },
              })
            }
          />
        ))}
      </div>

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-[#f7efe6]">Artists</h2>
          <p className="mt-1 text-[#e8d5c4]/90">
            {artistScenes.length
              ? `${artistScenes.length} artist graphics ready. Search or jump by letter.`
              : "No artist graphics on the wall yet."}
          </p>
        </div>

        {artistScenes.length ? (
          <>
            <ServerStationField label="Find an artist">
              <input
                className={serverStationInputClass}
                value={artistQuery}
                onChange={(event) => {
                  setArtistQuery(event.target.value);
                  if (event.target.value.trim()) setArtistLetter(null);
                }}
                placeholder="Start typing a name"
                autoCapitalize="words"
                autoCorrect="off"
              />
            </ServerStationField>

            <div className="flex flex-wrap gap-2">
              {LETTERS.map((letter) => {
                const enabled = availableLetters.has(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      setArtistLetter((current) => (current === letter ? null : letter));
                      setArtistQuery("");
                    }}
                    className={cn(
                      "min-h-12 min-w-12 rounded-xl px-3 text-base font-bold",
                      artistLetter === letter
                        ? "bg-[#d36b4a] text-white"
                        : enabled
                          ? "border border-white/15 bg-white/5 text-[#f7efe6]"
                          : "border border-white/5 bg-black/10 text-white/25",
                    )}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {showArtistResults ? (
              filteredArtists.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredArtists.map((scene) => (
                    <SceneButton
                      key={scene.id}
                      scene={scene}
                      pending={pending}
                      onPick={() =>
                        setConfirm({
                          label: scene.title,
                          payload: { sceneId: scene.id },
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-[#e8d5c4]">
                  No artists match that search.
                </p>
              )
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-[#e8d5c4]">
                Type a name or tap a letter to pull up artists without scrolling the full list.
              </p>
            )}
          </>
        ) : null}
      </section>

      {!houseScenes.length && !artistScenes.length ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-[#e8d5c4]">
          No scenes are available yet. Artist graphics appear automatically; ask an admin to approve house
          scenes in Settings → Server Station.
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
