"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  associateSessionEventAction,
  createMarkerAction,
  createProductionSessionAction,
  discoverEcammAction,
  endProductionSessionAction,
  enqueueDiagnosticsProbeAction,
  enqueueEcammCallAction,
  forgetEcammHostAction,
  refreshEcammAction,
  selectEcammHostAction,
  setAllowPerBusMuteAction,
  setProductionDeviceAction,
  setSceneFavoritesAction,
} from "@/actions/production";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StaffDisplayDevice } from "@/lib/display-devices/types";
import type {
  ProductionCommand,
  ProductionDeviceStatus,
  ProductionMarker,
  ProductionRecordingEvent,
  ProductionSession,
  ProductionSettings,
} from "@/lib/production/types";
import { productionCommandStatusLabel } from "@/lib/production/types";
import type { EcammLiveSnapshot } from "@/lib/production/types";
import type { ProductionPageEvent } from "@/lib/queries/production";
import { ECAMM_ENDPOINTS } from "@/lib/production/ecamm-endpoints";

type TabId =
  | "overview"
  | "scenes"
  | "audio"
  | "graphics"
  | "recordings"
  | "zoom"
  | "devices";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "scenes", label: "Scenes & Sources" },
  { id: "audio", label: "Audio" },
  { id: "graphics", label: "Graphics & Comments" },
  { id: "recordings", label: "Recordings" },
  { id: "zoom", label: "Zoom" },
  { id: "devices", label: "Devices & Diagnostics" },
];

const ZOOM_ENDPOINTS = ECAMM_ENDPOINTS.filter((e) => e.name.startsWith("setZoom") || e.name === "setSpotlightSelf");

function formatChicago(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function artistNames(event: ProductionPageEvent) {
  return (
    event.event_artists
      ?.map((row) => row.artists?.name)
      .filter(Boolean)
      .join(", ") || "—"
  );
}

export function ProductionWorkspace({
  venueName,
  initialEventId,
  initialTab,
  settings,
  deviceStatus,
  live,
  devices,
  sessions,
  markers,
  commands,
  recordingEvents,
  events,
  coverage,
  canControl,
  canConfigure,
  canViewOnly,
}: {
  venueName: string;
  initialEventId: string | null;
  initialTab: string;
  settings: ProductionSettings | null;
  deviceStatus: ProductionDeviceStatus | null;
  live: EcammLiveSnapshot | null;
  devices: StaffDisplayDevice[];
  sessions: ProductionSession[];
  markers: ProductionMarker[];
  commands: ProductionCommand[];
  recordingEvents: ProductionRecordingEvent[];
  events: ProductionPageEvent[];
  coverage: { total: number; reads: number; actions: number; byStatus: Record<string, number> };
  canControl: boolean;
  canConfigure: boolean;
  canViewOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : "overview",
  );
  const [eventId, setEventId] = useState(initialEventId || events[0]?.id || "");
  const [sceneQuery, setSceneQuery] = useState("");
  const [volumeDraft, setVolumeDraft] = useState<Record<string, number>>({});
  const [probeEndpoint, setProbeEndpoint] = useState("getInfo");

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const activeSession =
    sessions.find((s) => s.status !== "ended" && (!eventId || s.event_id === eventId)) ||
    sessions.find((s) => s.status !== "ended") ||
    null;

  const favorites = useMemo(() => {
    const scenes = Array.isArray(settings?.scene_favorites)
      ? (settings!.scene_favorites as unknown as string[])
      : Array.isArray(live?.favorites?.scenes)
        ? live!.favorites!.scenes!
        : [];
    const overlays = Array.isArray(settings?.overlay_favorites)
      ? (settings!.overlay_favorites as unknown as string[])
      : Array.isArray(live?.favorites?.overlays)
        ? live!.favorites!.overlays!
        : [];
    return { scenes: scenes as string[], overlays: overlays as string[] };
  }, [settings, live]);

  const scenes = useMemo(() => {
    const list = Array.isArray(live?.lists?.scenes) ? live!.lists!.scenes! : [];
    const q = sceneQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((s) => (s.label || s.id || "").toLowerCase().includes(q))
      : list;
    return [...filtered].sort((a, b) => {
      const af = favorites.scenes.includes(a.id) ? 0 : 1;
      const bf = favorites.scenes.includes(b.id) ? 0 : 1;
      return af - bf || (a.label || "").localeCompare(b.label || "");
    });
  }, [live, sceneQuery, favorites.scenes]);

  const overlays = Array.isArray(live?.lists?.overlays) ? live!.lists!.overlays! : [];
  const profiles = Array.isArray(live?.lists?.profiles) ? live!.lists!.profiles! : [];
  const sounds = Array.isArray(live?.lists?.sounds) ? live!.lists!.sounds! : [];
  const audioFilters = Array.isArray(live?.lists?.audioFilters) ? live!.lists!.audioFilters! : [];
  const volumes = (live?.volumes || {}) as Record<string, number>;
  const mutes = (live?.mutes || {}) as Record<string, boolean>;
  type DiscoveredHost = {
    hostname?: string;
    serviceName?: string;
    addresses?: string[];
    port?: number;
  };
  const discovered: DiscoveredHost[] = Array.isArray(live?.discovered)
    ? (live!.discovered as DiscoveredHost[])
    : [];
  const allowPerBusMute = Boolean(settings?.allow_per_bus_mute ?? live?.allowPerBusMute);

  const activeCommand = commands.find((c) =>
    ["pending", "queued", "sent", "acknowledged"].includes(c.status),
  );

  function run(task: () => Promise<{ ok: boolean; message: string }>) {
    if (!canControl && !canConfigure) {
      toast.error("Read-only — your role cannot control Production.");
      return;
    }
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
      router.refresh();
    });
  }

  function call(endpoint: string, params: Record<string, unknown> = {}) {
    run(() => enqueueEcammCallAction(endpoint, params));
  }

  const phase = deviceStatus?.connection_phase || live?.connectionPhase || "offline";
  const permission = deviceStatus?.approval_permission || live?.permission || "—";
  const macLabel =
    deviceStatus?.ecamm_hostname ||
    live?.hostname ||
    devices.find((d) => d.id === settings?.production_device_id)?.label ||
    "No Mac selected";

  const broadcastLabel = deviceStatus?.broadcast_inference || live?.broadcast?.inferred || "unknown";
  const broadcastSource =
    deviceStatus?.broadcast_inference_source || live?.broadcast?.source || "button_label_inference";
  const broadcastConfidence = live?.broadcast?.confidence || "inferred";

  return (
    <div
      className="production-room -mx-4 -mt-2 min-h-[calc(100vh-4rem)] rounded-2xl px-4 py-4 sm:-mx-6 sm:px-6 [&_input[type=range]]:accent-[var(--pr-accent)]"
      style={
        {
          "--pr-bg0": "#0c1118",
          "--pr-bg1": "#121a24",
          "--pr-panel": "#162030",
          "--pr-line": "#243247",
          "--pr-text": "#e8eef6",
          "--pr-muted": "#8fa3b8",
          "--pr-accent": "#d4a24c",
          "--pr-danger": "#c45c5c",
          "--pr-ok": "#6fbf8a",
          background:
            "radial-gradient(1200px 500px at 10% -10%, #1a2838 0%, transparent 55%), radial-gradient(900px 400px at 90% 0%, #1c2418 0%, transparent 50%), linear-gradient(180deg, var(--pr-bg0), var(--pr-bg1))",
          color: "var(--pr-text)",
        } as CSSProperties
      }
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--pr-accent)] uppercase">
            FloBama Production
          </p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight text-[var(--pr-text)]">
            Control room
          </h1>
          <p className="text-[var(--pr-muted)] mt-1 text-sm">{venueName} · Ecamm Live via Local Runner</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canControl ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
              onClick={() => run(() => refreshEcammAction())}
            >
              Refresh
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
            render={<Link href="/screens" />}
          >
            Screens / pairing
          </Button>
        </div>
      </header>

      {/* Persistent status strip */}
      <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 mb-4 grid gap-3 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatusCell label="Selected Mac" value={macLabel} />
        <StatusCell label="Connection" value={phase} tone={phase === "connected" ? "ok" : "warn"} />
        <StatusCell label="Approval" value={String(permission)} />
        <StatusCell label="Last update" value={formatChicago(deviceStatus?.reported_at)} />
        <StatusCell
          label="Event / artist"
          value={
            selectedEvent
              ? `${selectedEvent.title} · ${artistNames(selectedEvent)}`
              : activeSession?.title || "None"
          }
        />
        <StatusCell
          label="Current scene"
          value={deviceStatus?.current_scene_label || deviceStatus?.current_scene_id || live?.currentSceneId || "—"}
        />
        <StatusCell
          label="Recording / broadcast"
          value={`${broadcastLabel} (${broadcastConfidence})`}
          hint={`Source: ${broadcastSource}`}
        />
        <StatusCell
          label="Active command"
          value={
            activeCommand
              ? `${activeCommand.kind} · ${productionCommandStatusLabel(activeCommand.status)}`
              : activeCommand === undefined && commands[0]?.reject_reason
                ? `Error: ${commands[0].reject_reason}`
                : "None"
          }
          tone={commands[0]?.status === "failed" || commands[0]?.status === "rejected" ? "danger" : undefined}
        />
      </div>

      {canViewOnly ? (
        <p className="text-[var(--pr-muted)] mb-3 text-xs">
          Read-only view. Managers and admins can enqueue Ecamm commands; viewers cannot control.
        </p>
      ) : null}

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-[var(--pr-line)] pb-2" aria-label="Production sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-[var(--pr-accent)]/20 text-[var(--pr-accent)]"
                : "text-[var(--pr-muted)] hover:bg-white/5 hover:text-[var(--pr-text)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4 rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 p-4">
            <h2 className="text-lg font-semibold">Show setup</h2>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--pr-muted)]">Event (America/Chicago)</span>
              <select
                className="w-full rounded-md border border-[var(--pr-line)] bg-[var(--pr-bg0)] px-3 py-2"
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  router.replace(e.target.value ? `/production?eventId=${e.target.value}` : "/production");
                }}
              >
                <option value="">Select event…</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {formatChicago(event.starts_at)} · {event.title} · {artistNames(event)}
                  </option>
                ))}
              </select>
            </label>
            {selectedEvent ? (
              <p className="text-sm">
                <span className="text-[var(--pr-muted)]">Artist: </span>
                {artistNames(selectedEvent)}
              </p>
            ) : null}
            {canControl ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      createProductionSessionAction({
                        eventId: eventId || null,
                        artistIds:
                          selectedEvent?.event_artists
                            ?.map((row) => row.artists?.id)
                            .filter(Boolean) as string[] | undefined,
                        title: selectedEvent?.title || null,
                        startLive: true,
                      }),
                    )
                  }
                >
                  Start session
                </Button>
                {activeSession ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                    onClick={() => run(() => endProductionSessionAction(activeSession.id))}
                  >
                    End session
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-[var(--pr-muted)] uppercase">
                Broadcast controls
              </h3>
              <p className="text-[var(--pr-muted)] mb-2 text-xs">
                Labels come from Ecamm. Actions are queued — status shows queued/sent/acknowledged, never “confirmed”
                until observed.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!canControl || pending}
                  onClick={() => call("setClickButton")}
                >
                  {deviceStatus?.button_label || live?.buttonLabel || "Start / Stop"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canControl || pending}
                  className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                  onClick={() => call("setClickPauseButton")}
                >
                  {deviceStatus?.pause_button_label || live?.pauseButtonLabel || "Pause"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canControl || pending}
                  className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                  onClick={() => call("setStartNewRecording")}
                >
                  New recording
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canControl || pending || !activeSession}
                  className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                  onClick={() =>
                    activeSession &&
                    run(() => createMarkerAction({ sessionId: activeSession.id, label: "Highlight" }))
                  }
                >
                  Mark highlight
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 p-4">
              <h2 className="mb-2 text-lg font-semibold">Session timeline</h2>
              {sessions.length === 0 ? (
                <p className="text-[var(--pr-muted)] text-sm">No sessions yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sessions.slice(0, 8).map((session) => (
                    <li key={session.id} className="flex justify-between gap-2 border-b border-[var(--pr-line)] py-2">
                      <span>
                        {session.title || "Untitled"} · {session.status}
                        {session.event_id && selectedEvent?.id !== session.event_id ? (
                          <button
                            type="button"
                            className="ml-2 text-[var(--pr-accent)] underline"
                            disabled={!canControl || pending}
                            onClick={() =>
                              run(() =>
                                associateSessionEventAction({
                                  sessionId: session.id,
                                  eventId: eventId || null,
                                }),
                              )
                            }
                          >
                            Link event
                          </button>
                        ) : null}
                      </span>
                      <span className="text-[var(--pr-muted)]">{formatChicago(session.started_at || session.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 p-4">
              <h2 className="mb-2 text-lg font-semibold">Recent recordings</h2>
              {recordingEvents.length === 0 ? (
                <p className="text-[var(--pr-muted)] text-sm">No Shortcuts recording events yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recordingEvents.slice(0, 6).map((ev) => (
                    <li key={ev.id} className="border-b border-[var(--pr-line)] py-2">
                      <span className="font-medium">{ev.event_type}</span>
                      <span className="text-[var(--pr-muted)] block truncate text-xs">{ev.path_text || "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[var(--pr-muted)] mt-3 text-xs">
                Recovery: if Ecamm disconnects mid-show, keep recording on the Mac. Re-approve Remote Control in Ecamm →
                Preferences if approval shows Denied. Pairing is under Screens → Display devices → Production Local
                Runner.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "scenes" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grow space-y-1 text-sm">
              <span className="text-[var(--pr-muted)]">Search scenes</span>
              <input
                className="w-full rounded-md border border-[var(--pr-line)] bg-[var(--pr-bg0)] px-3 py-2"
                value={sceneQuery}
                onChange={(e) => setSceneQuery(e.target.value)}
                placeholder="Filter by name…"
              />
            </label>
            <Button type="button" disabled={!canControl || pending} onClick={() => call("setPrev")}>
              Prev
            </Button>
            <Button type="button" disabled={!canControl || pending} onClick={() => call("setNext")}>
              Next
            </Button>
          </div>
          {scenes.length === 0 ? (
            <p className="text-[var(--pr-muted)] text-sm">
              No scene list in the latest runner report. Use Refresh after Ecamm is connected and approved.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {scenes.map((scene) => {
                const current =
                  scene.current ||
                  scene.id === (deviceStatus?.current_scene_id || live?.currentSceneId);
                const fav = favorites.scenes.includes(scene.id);
                return (
                  <button
                    key={scene.id}
                    type="button"
                    disabled={!canControl || pending}
                    onClick={() => call("setScene", { id: scene.id })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      current
                        ? "border-[var(--pr-accent)] bg-[var(--pr-accent)]/10"
                        : "border-[var(--pr-line)] bg-[var(--pr-panel)] hover:border-[var(--pr-accent)]/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{scene.label || scene.id}</span>
                      {fav ? <span className="text-xs text-[var(--pr-accent)]">★</span> : null}
                    </div>
                    {scene.groupName ? <p className="text-[var(--pr-muted)] mt-1 text-xs">{scene.groupName}</p> : null}
                    {current ? <p className="mt-1 text-xs text-[var(--pr-ok)]">Current</p> : null}
                  </button>
                );
              })}
            </div>
          )}
          <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <ControlBlock title="Mode">
              <Button type="button" size="sm" disabled={!canControl || pending} onClick={() => call("setMode", { mode: "camera" })}>
                Camera
              </Button>
              <Button type="button" size="sm" disabled={!canControl || pending} onClick={() => call("setMode", { mode: "screen" })}>
                Screen
              </Button>
            </ControlBlock>
            <ControlBlock title="Video / PIP">
              <Button type="button" size="sm" disabled={!canControl || pending} onClick={() => call("setPIP")}>
                Toggle PIP
              </Button>
            </ControlBlock>
            <ControlBlock title="Preview / Publish">
              <Button type="button" size="sm" disabled={!canControl || pending} onClick={() => call("setPreviewMode")}>
                Toggle preview
              </Button>
              <Button type="button" size="sm" disabled={!canControl || pending} onClick={() => call("setPublish")}>
                Toggle publish
              </Button>
            </ControlBlock>
            <ControlBlock title="Profiles">
              {profiles.slice(0, 6).map((profile) => (
                <Button
                  key={profile.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                  disabled={!canControl || pending}
                  onClick={() => call("setProfile", { id: profile.id })}
                >
                  {profile.label || profile.id}
                </Button>
              ))}
              {!profiles.length ? <p className="text-[var(--pr-muted)] text-xs">No profiles reported.</p> : null}
            </ControlBlock>
          </div>
          {canConfigure ? (
            <Button
              type="button"
              variant="outline"
              className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setSceneFavoritesAction({
                    scenes: scenes.slice(0, 12).map((s) => s.id),
                    overlays: favorites.overlays,
                  }),
                )
              }
            >
              Save top visible scenes as favorites
            </Button>
          ) : null}
        </section>
      ) : null}

      {tab === "audio" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canControl || pending} onClick={() => call("setMute")}>
              {live?.mute ? "Unmute (global)" : "Mute (global)"}
            </Button>
            <p className="text-[var(--pr-muted)] self-center text-xs">
              No fake meters. Levels are Ecamm bus values only when reported.
            </p>
          </div>
          {Object.keys(volumes).length === 0 ? (
            <p className="text-[var(--pr-muted)] text-sm">No bus volumes in the latest status. Refresh after connection.</p>
          ) : (
            <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 grid gap-4 p-4 sm:grid-cols-2">
              {Object.entries(volumes).map(([bus, value]) => {
                const n = typeof value === "number" ? value : Number(value) || 0;
                const draft = volumeDraft[bus] ?? n;
                const muted = Boolean(mutes[bus]);
                return (
                  <div key={bus} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{bus}</span>
                      <span className="text-[var(--pr-muted)]">{Math.round(draft)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft}
                      disabled={!canControl || pending}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setVolumeDraft((prev) => ({ ...prev, [bus]: next }));
                      }}
                      onMouseUp={() => call("setVolume", { bus, volume: volumeDraft[bus] ?? n })}
                      onTouchEnd={() => call("setVolume", { bus, volume: volumeDraft[bus] ?? n })}
                      className="w-full"
                    />
                    {allowPerBusMute ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                        disabled={!canControl || pending}
                        onClick={() => call("setMute", { bus })}
                      >
                        {muted ? `Unmute ${bus}` : `Mute ${bus}`}
                      </Button>
                    ) : (
                      <p className="text-[var(--pr-muted)] text-xs">Per-bus mute locked (admin can enable after venue testing).</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 p-4">
            <h3 className="mb-2 font-semibold">Soundboard / filters</h3>
            <div className="flex flex-wrap gap-2">
              {sounds.slice(0, 12).map((sound) => (
                <Button
                  key={sound.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                  disabled={!canControl || pending}
                  onClick={() => call("setSound", { id: sound.id })}
                >
                  {sound.label || sound.id}
                </Button>
              ))}
              {audioFilters.slice(0, 8).map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                  disabled={!canControl || pending}
                  onClick={() => call("setAudioFilter", { id: filter.id })}
                >
                  Filter: {filter.label || filter.id}
                </Button>
              ))}
              {!sounds.length && !audioFilters.length ? (
                <p className="text-[var(--pr-muted)] text-sm">No sounds or filters reported.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "graphics" ? (
        <section className="space-y-4">
          <p className="text-[var(--pr-muted)] text-sm">
            Overlays for the current scene. Also see FloBama wall overlays under{" "}
            <Link href="/screens" className="text-[var(--pr-accent)] underline">
              Screens
            </Link>
            .
          </p>
          {overlays.length === 0 ? (
            <p className="text-[var(--pr-muted)] text-sm">No overlays reported for the current scene.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overlays.map((overlay) => (
                <div key={overlay.id} className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 flex items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium">{overlay.label || overlay.id}</p>
                    <p className="text-[var(--pr-muted)] text-xs">
                      {overlay.visible ? "Visible" : "Hidden"}
                      {overlay.isComment ? " · Comment" : ""}
                      {favorites.overlays.includes(overlay.id) ? " · Favorite" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canControl || pending}
                    onClick={() => call("setOverlay", { id: overlay.id })}
                  >
                    Toggle
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canControl || pending} onClick={() => call("setShowComment")}>
              Show comment
            </Button>
            <Button type="button" disabled={!canControl || pending} onClick={() => call("setHideComment")}>
              Hide comment
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "recordings" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 p-4">
            <h2 className="mb-3 text-lg font-semibold">Sessions</h2>
            <ul className="space-y-2 text-sm">
              {sessions.map((session) => (
                <li key={session.id} className="border-b border-[var(--pr-line)] py-2">
                  <div className="font-medium">
                    {session.title || "Untitled"} · {session.status}
                  </div>
                  <div className="text-[var(--pr-muted)] text-xs">
                    {formatChicago(session.started_at)} → {formatChicago(session.ended_at)}
                    {session.ecamm_recording_path ? ` · ${session.ecamm_recording_path}` : ""}
                  </div>
                  {session.performance_recording_id ? (
                    <Link
                      href="/screens?tab=performance"
                      className="text-xs text-[var(--pr-accent)] underline"
                    >
                      Open Performance Library
                    </Link>
                  ) : (
                    <Link href="/screens" className="text-xs text-[var(--pr-accent)] underline">
                      Performance Library
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 p-4">
            <h2 className="mb-3 text-lg font-semibold">Markers</h2>
            <ul className="space-y-2 text-sm">
              {markers.length === 0 ? (
                <li className="text-[var(--pr-muted)]">No markers yet.</li>
              ) : (
                markers.map((marker) => (
                  <li key={marker.id} className="border-b border-[var(--pr-line)] py-2">
                    <span className="font-medium">{marker.label}</span>
                    <span className="text-[var(--pr-muted)] ml-2 text-xs">
                      OS saved · Ecamm {marker.ecamm_status}
                      {marker.relative_seconds != null ? ` · ${Math.round(marker.relative_seconds)}s` : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "zoom" ? (
        <section className="space-y-4">
          <p className="text-[var(--pr-muted)] text-sm">
            Zoom in meeting: {deviceStatus?.zoom_in_meeting || live?.zoomInMeeting ? "yes" : "no / unknown"}. End
            meeting requires confirmation.
          </p>
          <div className="flex flex-wrap gap-2">
            {ZOOM_ENDPOINTS.filter((e) => e.name !== "setZoomLeave").map((endpoint) => (
              <Button
                key={endpoint.name}
                type="button"
                size="sm"
                variant="outline"
                className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                disabled={!canControl || pending}
                onClick={() => call(endpoint.name)}
                title={endpoint.limitations}
              >
                {endpoint.name.replace(/^setZoom/, "").replace(/^set/, "")}
              </Button>
            ))}
            <Button
              type="button"
              variant="destructive"
              disabled={!canControl || pending}
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("End the Zoom meeting on Ecamm?")) {
                  call("setZoomLeave");
                }
              }}
            >
              End meeting
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "devices" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 space-y-3 p-4">
            <h2 className="text-lg font-semibold">Production device</h2>
            {canConfigure ? (
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--pr-muted)]">Paired runner</span>
                <select
                  className="w-full rounded-md border border-[var(--pr-line)] bg-[var(--pr-bg0)] px-3 py-2"
                  value={settings?.production_device_id || ""}
                  onChange={(e) => run(() => setProductionDeviceAction(e.target.value || null))}
                >
                  <option value="">Auto (freshest production runner)</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label} · {device.kind}
                      {device.revoked_at ? " (revoked)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm">{macLabel}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {canConfigure ? (
                <>
                  <Button type="button" disabled={pending} onClick={() => run(() => discoverEcammAction())}>
                    Discover
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                    disabled={pending}
                    onClick={() => run(() => forgetEcammHostAction())}
                  >
                    Forget host
                  </Button>
                </>
              ) : null}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Discovered Macs</h3>
              {discovered.length === 0 ? (
                <p className="text-[var(--pr-muted)] text-sm">None in last report. Run Discover while Ecamm is open on the LAN.</p>
              ) : (
                <ul className="space-y-2">
                  {discovered.map((host, index) => (
                    <li
                      key={`${host.hostname || "host"}-${index}`}
                      className="flex items-center justify-between gap-2 border-b border-[var(--pr-line)] py-2 text-sm"
                    >
                      <span>
                        {host.hostname || "Unknown"}
                        <span className="text-[var(--pr-muted)] block text-xs">
                          {(host.addresses || []).join(", ") || "—"}:{host.port || "—"}
                        </span>
                      </span>
                      {canConfigure ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending || !host.hostname}
                          onClick={() =>
                            run(() =>
                              selectEcammHostAction({
                                hostname: host.hostname || "",
                                serviceName: host.serviceName,
                                preferredAddress: host.addresses?.[0],
                              }),
                            )
                          }
                        >
                          Select
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[var(--pr-muted)] text-xs">
              Approval: on the Ecamm Mac, allow “FloBama OS” under Ecamm Live → Preferences → Remote Control. Denied
              must be cleared on the Mac before retrying.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--pr-line)] bg-[var(--pr-panel)]/95 space-y-3 p-4">
            <h2 className="text-lg font-semibold">Diagnostics</h2>
            <p className="text-sm">
              Endpoint coverage: {coverage.total} total · {coverage.reads} reads · {coverage.actions} actions
            </p>
            <ul className="text-[var(--pr-muted)] text-xs">
              {Object.entries(coverage.byStatus).map(([status, count]) => (
                <li key={status}>
                  {status}: {count}
                </li>
              ))}
            </ul>
            {canConfigure ? (
              <div className="space-y-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--pr-muted)]">Allow per-bus mute (undocumented)</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || allowPerBusMute}
                      onClick={() => run(() => setAllowPerBusMuteAction(true))}
                    >
                      Enable
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[var(--pr-line)] bg-transparent text-[var(--pr-text)]"
                      disabled={pending || !allowPerBusMute}
                      onClick={() => run(() => setAllowPerBusMuteAction(false))}
                    >
                      Disable
                    </Button>
                  </div>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--pr-muted)]">Sanitized probe (admin)</span>
                  <div className="flex gap-2">
                    <select
                      className="grow rounded-md border border-[var(--pr-line)] bg-[var(--pr-bg0)] px-3 py-2"
                      value={probeEndpoint}
                      onChange={(e) => setProbeEndpoint(e.target.value)}
                    >
                      {ECAMM_ENDPOINTS.filter((e) => e.kind === "read").map((e) => (
                        <option key={e.name} value={e.name}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => enqueueDiagnosticsProbeAction({ endpoint: probeEndpoint }))}
                    >
                      Probe
                    </Button>
                  </div>
                </label>
              </div>
            ) : null}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Recent commands</h3>
              <ul className="max-h-64 space-y-1 overflow-auto text-xs">
                {commands.map((command) => (
                  <li key={command.id} className="border-b border-[var(--pr-line)] py-1.5">
                    <span className="font-medium">{command.kind}</span>
                    {command.endpoint ? ` · ${command.endpoint}` : ""}
                    {" · "}
                    <span className="text-[var(--pr-accent)]">
                      {productionCommandStatusLabel(command.status)}
                    </span>
                    {command.reject_reason ? (
                      <span className="block text-[var(--pr-danger)]">{command.reject_reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatusCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[var(--pr-muted)] text-[10px] font-semibold tracking-wide uppercase">{label}</p>
      <p
        className={cn(
          "truncate font-medium",
          tone === "ok" && "text-[var(--pr-ok)]",
          tone === "warn" && "text-[var(--pr-accent)]",
          tone === "danger" && "text-[var(--pr-danger)]",
        )}
        title={hint ? `${value} — ${hint}` : value}
      >
        {value}
      </p>
      {hint ? <p className="text-[var(--pr-muted)] truncate text-[10px]">{hint}</p> : null}
    </div>
  );
}

function ControlBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[var(--pr-muted)] mb-2 text-xs font-semibold tracking-wide uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
