"use client";

import { useMemo, useState } from "react";
import OBSWebSocket from "obs-websocket-js";
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

export function ObsPanel() {
  const [form, setForm] = useState<ObsConnectionInput>(() =>
    typeof window === "undefined" ? defaultObsConnection() : readObsConnection(),
  );
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [message, setMessage] = useState("Not connected. OBS WebSocket stays on the booth PC.");
  const [scenes, setScenes] = useState<ObsScene[]>([]);
  const [program, setProgram] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [studio, setStudio] = useState(false);
  const [client] = useState(() => new OBSWebSocket());

  const url = useMemo(() => buildObsWebsocketUrl(form.host, form.port), [form.host, form.port]);

  async function refresh() {
    const list = mapObsSceneList(await client.call("GetSceneList"));
    setScenes(list.scenes);
    setProgram(list.program);
    setPreview(list.preview);
    const studioState = await client.call("GetStudioModeEnabled");
    setStudio(Boolean(studioState.studioModeEnabled));
  }

  async function connect() {
    if (!url) {
      setMessage("Enter a host and numeric port.");
      return;
    }
    writeObsConnection(form);
    setStatus("connecting");
    setMessage("Connecting…");
    try {
      await client.connect(url, form.password || undefined);
      setStatus("connected");
      setMessage(`Connected to ${url}`);
      await refresh();
    } catch (error) {
      setStatus("disconnected");
      setMessage(error instanceof Error ? error.message : "Could not reach OBS. This preview cannot see the booth LAN.");
    }
  }

  async function disconnect() {
    try {
      await client.disconnect();
    } catch {
      // already closed
    }
    setStatus("disconnected");
    setScenes([]);
    setProgram(null);
    setMessage("Disconnected.");
  }

  async function cutTo(sceneName: string) {
    try {
      if (studio) {
        await client.call("SetCurrentPreviewScene", { sceneName });
        await client.call("TriggerStudioModeTransition");
      } else {
        await client.call("SetCurrentProgramScene", { sceneName });
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scene switch failed.");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">OBS WebSocket</h2>
        <p className="text-sm text-muted-foreground">
          Host, port, and password are stored in this browser tab only. They are never written to FloBama OS.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="obs-host">Host</Label>
          <Input id="obs-host" value={form.host} onChange={(e) => setForm((c) => ({ ...c, host: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs-port">Port</Label>
          <Input id="obs-port" value={form.port} onChange={(e) => setForm((c) => ({ ...c, port: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs-password">Password</Label>
          <Input
            id="obs-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "connected" ? (
          <Button type="button" variant="outline" onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button type="button" onClick={() => void connect()} disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting…" : "Connect"}
          </Button>
        )}
        <span className="self-center text-sm text-muted-foreground">{message}</span>
      </div>
      {status !== "connected" ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No OBS connection. On the booth machine: OBS → Tools → WebSocket Server Settings. This cloud preview cannot
          reach a LAN WebSocket.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {scenes.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">OBS reported no scenes.</li>
          ) : (
            scenes.map((scene) => (
              <li key={scene.sceneName} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <div>
                  <p className="font-medium">{scene.sceneName}</p>
                  <p className="text-xs text-muted-foreground">
                    {program === scene.sceneName ? "Program" : preview === scene.sceneName ? "Preview" : "Standby"}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void cutTo(scene.sceneName)}>
                  {studio ? "Transition" : "Cut"}
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
