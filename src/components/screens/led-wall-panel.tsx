"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import OBSWebSocket from "obs-websocket-js";
import { toast } from "sonner";
import { saveScreenWallAction } from "@/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildObsWebsocketUrl,
  defaultObsConnection,
  mapObsSceneList,
  readObsConnection,
  writeObsConnection,
  type ObsConnectionInput,
  type ObsScene,
} from "@/lib/obs/session";
import { liveFromNowPayload, resolveWallScene } from "@/lib/screens/wall";
import type { ScreenWallMode } from "@/lib/constants";
import type { WallStateRow } from "@/lib/queries/screens";

export function LedWallPanel({ wall }: { wall: WallStateRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<ScreenWallMode>(wall?.mode ?? "auto");
  const [adsScene, setAdsScene] = useState(wall?.ads_scene_name ?? "");
  const [bandScene, setBandScene] = useState(wall?.band_scene_name ?? "");
  const [manualScene, setManualScene] = useState(wall?.manual_scene_name ?? "");
  const [form, setForm] = useState<ObsConnectionInput>(() =>
    typeof window === "undefined" ? defaultObsConnection() : readObsConnection(),
  );
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [message, setMessage] = useState("Connect from the booth PC. OBS stays on the LAN.");
  const [scenes, setScenes] = useState<ObsScene[]>([]);
  const [program, setProgram] = useState<string | null>(null);
  const [client] = useState(() => new OBSWebSocket());
  const lastCut = useRef<string | null>(null);
  const url = useMemo(() => buildObsWebsocketUrl(form.host, form.port), [form.host, form.port]);

  const cutTo = useCallback(
    async (sceneName: string | null) => {
      if (!sceneName || status !== "connected") return;
      if (lastCut.current === sceneName && program === sceneName) return;
      try {
        await client.call("SetCurrentProgramScene", { sceneName });
        lastCut.current = sceneName;
        setProgram(sceneName);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Scene switch failed.");
      }
    },
    [client, program, status],
  );

  async function connect() {
    if (!url) {
      setMessage("Enter a host and numeric port.");
      return;
    }
    writeObsConnection(form);
    setStatus("connecting");
    try {
      await client.connect(url, form.password || undefined);
      const list = mapObsSceneList(await client.call("GetSceneList"));
      setScenes(list.scenes);
      setProgram(list.program);
      setStatus("connected");
      setMessage(`Connected to ${url}`);
    } catch (error) {
      setStatus("disconnected");
      setMessage(error instanceof Error ? error.message : "Could not reach OBS from this machine.");
    }
  }

  const cutNow = useCallback(async () => {
    if (mode === "manual") {
      await cutTo(manualScene);
      return;
    }
    try {
      const response = await fetch("/api/public/v1/now", { cache: "no-store" });
      const json = (await response.json()) as {
        nowPlaying?: { id?: string } | null;
        today?: Array<{ startsAt: string; endsAt: string }>;
      };
      const target = resolveWallScene(
        {
          mode: "auto",
          adsSceneName: adsScene,
          bandSceneName: bandScene,
          manualSceneName: manualScene,
        },
        liveFromNowPayload(json),
      );
      await cutTo(target);
    } catch {
      setMessage("Could not read now-playing for an auto cut.");
    }
  }, [adsScene, bandScene, cutTo, manualScene, mode]);

  useEffect(() => {
    if (status !== "connected" || mode !== "auto") return;
    let cancelled = false;
    async function tick() {
      if (!cancelled) await cutNow();
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status, mode, cutNow]);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">LED wall</h2>
        <p className="text-sm text-muted-foreground">
          Map prebuilt OBS scenes. Auto uses Ads unless a public show is on now, then Band. Artwork stays in OBS.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="wall-host">OBS host</Label>
          <Input id="wall-host" value={form.host} onChange={(e) => setForm((c) => ({ ...c, host: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wall-port">Port</Label>
          <Input id="wall-port" value={form.port} onChange={(e) => setForm((c) => ({ ...c, port: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wall-password">Password</Label>
          <Input
            id="wall-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "connected" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void client.disconnect();
              setStatus("disconnected");
              setScenes([]);
              setMessage("Disconnected.");
            }}
          >
            Disconnect
          </Button>
        ) : (
          <Button type="button" onClick={() => void connect()} disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting…" : "Connect OBS"}
          </Button>
        )}
        <span className="self-center text-sm text-muted-foreground">{message}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SceneField
          id="ads-scene"
          label="Ads scene"
          value={adsScene}
          scenes={scenes}
          onChange={setAdsScene}
        />
        <SceneField
          id="band-scene"
          label="Band scene"
          value={bandScene}
          scenes={scenes}
          onChange={setBandScene}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="wall-mode"
            checked={mode === "auto"}
            onChange={() => setMode("auto")}
          />
          Auto (ads unless a show is on)
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="wall-mode"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
          />
          Manual
        </label>
      </div>

      {mode === "manual" ? (
        <SceneField
          id="manual-scene"
          label="Manual scene"
          value={manualScene}
          scenes={scenes}
          onChange={setManualScene}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await saveScreenWallAction({
                mode,
                adsSceneName: adsScene,
                bandSceneName: bandScene,
                manualSceneName: manualScene,
              });
              if (!result.ok) toast.error(result.message);
              else {
                toast.success(result.message);
                router.refresh();
              }
            });
          }}
        >
          {pending ? "Saving…" : "Save wall settings"}
        </Button>
        <Button type="button" variant="outline" disabled={status !== "connected"} onClick={() => void cutNow()}>
          Cut now
        </Button>
        <p className="self-center text-xs text-muted-foreground">Program: {program || "unknown"}</p>
      </div>
    </section>
  );
}

function SceneField({
  id,
  label,
  value,
  scenes,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  scenes: ObsScene[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {scenes.length > 0 ? (
        <select
          id={id}
          className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a scene</option>
          {scenes.map((scene) => (
            <option key={scene.sceneName} value={scene.sceneName}>
              {scene.sceneName}
            </option>
          ))}
        </select>
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Exact OBS scene name" />
      )}
    </div>
  );
}
