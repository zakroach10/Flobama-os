"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  activateLedWallSceneAction,
  createLedObsSceneAction,
  deleteLedWallSceneAction,
  issueLedWallAgentTokenAction,
  reorderLedWallScenesAction,
  saveLedWallMediaSceneAction,
  updateLedWallSceneAction,
} from "@/actions/led-wall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicSupabaseEnv } from "@/lib/env";
import type { LedWallAgentSnapshot, LedWallSceneRow } from "@/lib/queries/led-wall";
import { agentStatusCopy } from "@/lib/screens/led-wall";
import { uploadLedMediaFromBrowser } from "@/lib/screens/led-upload";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";
import { ObsClientDownload } from "@/components/screens/obs-client-download";

export function LedWallPanel({
  scenes,
  activeSceneId,
  agent,
  canConfigure,
  mediaObsSceneName,
  tokenIssuedAt,
  venueId,
  displayUrl,
  supabaseEnv,
}: {
  scenes: LedWallSceneRow[];
  activeSceneId: string | null;
  agent: LedWallAgentSnapshot;
  canConfigure: boolean;
  mediaObsSceneName: string;
  tokenIssuedAt: string | null;
  venueId: string;
  displayUrl: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const visible = canConfigure ? scenes : scenes.filter((scene) => scene.enabled);
  const [setupOpen, setSetupOpen] = useState(false);

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">LED wall</h2>
            <p className="text-sm text-muted-foreground">Activate a scene to put it on the wall.</p>
          </div>
          {canConfigure ? (
            <Button type="button" variant="outline" onClick={() => setSetupOpen((open) => !open)}>
              {setupOpen ? "Hide OBS setup" : "OBS Setup"}
            </Button>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canConfigure ? "No scenes yet. Add one below." : "No scenes are ready yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((scene) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                active={scene.id === activeSceneId}
                canConfigure={canConfigure}
                scenes={scenes}
              />
            ))}
          </ul>
        )}
      </section>
      {canConfigure ? (
        <AdminLedWall
          agent={agent}
          mediaObsSceneName={mediaObsSceneName}
          tokenIssuedAt={tokenIssuedAt}
          venueId={venueId}
          displayUrl={displayUrl}
          supabaseEnv={supabaseEnv}
          setupOpen={setupOpen}
        />
      ) : null}
    </div>
  );
}

function SceneRow({
  scene,
  active,
  canConfigure,
  scenes,
}: {
  scene: LedWallSceneRow;
  active: boolean;
  canConfigure: boolean;
  scenes: LedWallSceneRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(scene.title);
  const detail =
    scene.kind === "obs"
      ? `OBS scene: ${scene.obs_scene_name}`
      : scene.media_kind === "video"
        ? "MP4 loop on the FloBama display page"
        : "PNG on the FloBama display page";

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            {scene.title}
            {!scene.enabled ? <span className="ml-2 text-xs text-muted-foreground">Disabled</span> : null}
            {active ? <span className="ml-2 text-xs text-muted-foreground">Active</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
        <Button
          type="button"
          disabled={pending || !scene.enabled || active}
          onClick={() => run(() => activateLedWallSceneAction({ sceneId: scene.id }))}
        >
          {active ? "Active" : pending ? "Activating…" : "Activate"}
        </Button>
      </div>
      {canConfigure ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor={`scene-title-${scene.id}`}>Title</Label>
            <Input id={`scene-title-${scene.id}`} value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => updateLedWallSceneAction({ id: scene.id, title, enabled: scene.enabled }))}
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => updateLedWallSceneAction({ id: scene.id, title: scene.title, enabled: !scene.enabled }))}
          >
            {scene.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || scenes[0]?.id === scene.id}
            onClick={() => run(() => reorderLedWallScenesAction({ ids: moveScene(scenes, scene.id, -1) }))}
          >
            Up
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || scenes[scenes.length - 1]?.id === scene.id}
            onClick={() => run(() => reorderLedWallScenesAction({ ids: moveScene(scenes, scene.id, 1) }))}
          >
            Down
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => deleteLedWallSceneAction(scene.id))}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function AdminLedWall({
  agent,
  mediaObsSceneName,
  tokenIssuedAt,
  venueId,
  displayUrl,
  supabaseEnv,
  setupOpen,
}: {
  agent: LedWallAgentSnapshot;
  mediaObsSceneName: string;
  tokenIssuedAt: string | null;
  venueId: string;
  displayUrl: string;
  supabaseEnv: PublicSupabaseEnv | null;
  setupOpen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [obsTitle, setObsTitle] = useState("");
  const [obsName, setObsName] = useState("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [browserScene, setBrowserScene] = useState(mediaObsSceneName);
  const [token, setToken] = useState<string | null>(null);
  const reported = agent.obsScenes;

  return (
    <>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Add an OBS scene</h2>
          <p className="text-sm text-muted-foreground">
            Pick a scene the booth client reported from OBS, or type the exact scene name.
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await createLedObsSceneAction({ title: obsTitle, obsSceneName: obsName });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(result.message);
              setObsTitle("");
              setObsName("");
              router.refresh();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="obs-scene-title">Title</Label>
            <Input id="obs-scene-title" value={obsTitle} onChange={(event) => setObsTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs-scene-name">OBS scene</Label>
            {reported.length > 0 ? (
              <select
                id="obs-scene-name"
                className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={obsName}
                onChange={(event) => setObsName(event.target.value)}
              >
                <option value="">Select a scene</option>
                {reported.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="obs-scene-name"
                value={obsName}
                onChange={(event) => setObsName(event.target.value)}
                placeholder="Exact OBS scene name"
              />
            )}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add OBS scene"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Upload a loop or still</h2>
          <p className="text-sm text-muted-foreground">
            MP4 files loop and PNG files stay on screen. Activating the upload cuts OBS to the media browser scene,
            which loads {displayUrl}.
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) {
              toast.error("Choose an MP4 or PNG.");
              return;
            }
            startTransition(async () => {
              const result = await uploadLedMediaFromBrowser({
                file,
                venueId,
                title: mediaTitle,
                supabaseEnv,
              });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(result.message);
              setMediaTitle("");
              setFile(null);
              setFileKey((value) => value + 1);
              router.refresh();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="led-media-title">Title</Label>
            <Input id="led-media-title" value={mediaTitle} onChange={(event) => setMediaTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="led-media-file">MP4 or PNG</Label>
            <input
              key={fileKey}
              id="led-media-file"
              type="file"
              accept="video/mp4,image/png,.mp4,.png"
              className="block w-full text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">50 MB max ({Math.round(MAX_SCREEN_AD_BYTES / (1024 * 1024))} MB).</p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Upload scene"}
          </Button>
        </form>
      </section>

      {setupOpen ? (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">OBS setup</h2>
            <p className="text-sm text-muted-foreground">{agentStatusCopy(agent)}</p>
          </div>
          <ObsClientDownload />
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await saveLedWallMediaSceneAction({ mediaObsSceneName: browserScene });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="media-browser-scene">OBS scene for uploaded media</Label>
              {reported.length > 0 || browserScene ? (
                <select
                  id="media-browser-scene"
                  className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                  value={browserScene}
                  onChange={(event) => setBrowserScene(event.target.value)}
                >
                  <option value="">Select the browser-source scene</option>
                  {browserScene && !reported.includes(browserScene) ? (
                    <option value={browserScene}>{browserScene}</option>
                  ) : null}
                  {reported.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="media-browser-scene"
                  value={browserScene}
                  onChange={(event) => setBrowserScene(event.target.value)}
                  placeholder="OBS scene with the /display/led browser source"
                />
              )}
              <p className="text-sm text-muted-foreground">
                In that OBS scene, add a Browser Source pointed at {displayUrl}. Every uploaded scene uses this one OBS
                scene. The page swaps the file.
              </p>
            </div>
            <Button type="submit" variant="outline" disabled={pending}>
              Save media scene
            </Button>
          </form>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tokenIssuedAt ? "A booth token is already issued. Issuing another replaces it." : "No booth token yet."}{" "}
              Open the Mac app and paste the token. Leave its window running next to OBS.
            </p>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await issueLedWallAgentTokenAction();
                  if (!result.ok || !result.token) {
                    toast.error(result.message);
                    return;
                  }
                  setToken(result.token);
                  toast.success(result.message);
                  router.refresh();
                });
              }}
            >
              {tokenIssuedAt ? "Replace booth token" : "Create booth token"}
            </Button>
            {token ? (
              <div className="space-y-2">
                <Label htmlFor="booth-token">Booth token</Label>
                <Input id="booth-token" readOnly value={token} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(token);
                    toast.success("Copied booth token");
                  }}
                >
                  Copy token
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function moveScene(scenes: LedWallSceneRow[], id: string, direction: -1 | 1) {
  const ids = scenes.map((scene) => scene.id);
  const index = ids.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  const copy = [...ids];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}
