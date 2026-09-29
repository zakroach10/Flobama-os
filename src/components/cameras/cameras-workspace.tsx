"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCameraPairingCodeAction,
  deleteCameraSourceAction,
  endCameraPreviewAction,
  issueCameraCommandAction,
  releaseCameraLeaseAction,
  renewCameraLeaseAction,
  revokeCameraDeviceAction,
  startCameraPreviewAction,
} from "@/actions/cameras";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CameraLeaseRow } from "@/lib/queries/cameras";
import type { StaffCameraDevice, StaffCameraInventoryItem, StaffCameraSource } from "@/lib/cameras/types";
import { describeCameraConnectorLink, formatCameraHeartbeat } from "@/lib/cameras/status";
import { linkStatusLabel } from "@/lib/cameras/map";
import { CameraPtzPad } from "@/components/cameras/camera-ptz-pad";
import { CameraInventoryForm } from "@/components/cameras/camera-inventory-form";
import { MacCameraDownload } from "@/components/cameras/mac-camera-download";
import { CAMERA_CONNECTOR_VERSION } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CamerasWorkspace({
  devices,
  cameras,
  inventory,
  leases,
  currentUserId,
  canOperate,
  canConfigure,
  apiBase,
}: {
  devices: StaffCameraDevice[];
  cameras: StaffCameraSource[];
  inventory: StaffCameraInventoryItem[];
  leases: CameraLeaseRow[];
  currentUserId: string;
  canOperate: boolean;
  canConfigure: boolean;
  apiBase: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(cameras[0]?.id ?? null);
  const [speed, setSpeed] = useState(8);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [previewTick, setPreviewTick] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const resolvedSelectedId =
    selectedId && cameras.some((camera) => camera.id === selectedId) ? selectedId : (cameras[0]?.id ?? null);
  const selected = cameras.find((camera) => camera.id === resolvedSelectedId) ?? null;
  const activeDevice = useMemo(() => {
    const live = devices.filter((device) => !device.revokedAt);
    if (live.length === 0) return devices[0] ?? null;
    return [...live].sort(
      (a, b) => Date.parse(b.lastSeenAt ?? "") - Date.parse(a.lastSeenAt ?? ""),
    )[0];
  }, [devices]);
  const leaseByCamera = useMemo(() => new Map(leases.map((lease) => [lease.cameraId, lease])), [leases]);
  const myLease = selected ? leaseByCamera.get(selected.id) : undefined;
  const iHoldLease = Boolean(myLease && myLease.holderUserId === currentUserId);

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(id);
  }, [router]);

  useEffect(() => {
    if (!previewSessionId) return;
    const id = window.setInterval(() => setPreviewTick((n) => n + 1), 900);
    return () => window.clearInterval(id);
  }, [previewSessionId]);

  useEffect(() => {
    setPreviewError(null);
  }, [previewSessionId, resolvedSelectedId]);

  useEffect(() => {
    if (!canOperate || !selected || !iHoldLease) return;
    const id = window.setInterval(() => {
      void renewCameraLeaseAction({ cameraId: selected.id });
    }, 8_000);
    return () => window.clearInterval(id);
  }, [canOperate, selected, iHoldLease]);

  const stopAll = useCallback(async () => {
    if (!selected || !canOperate) return;
    const result = await issueCameraCommandAction({ cameraId: selected.id, kind: "ptz_stop" });
    if (!result.ok) toast.error(result.message);
  }, [selected, canOperate]);

  useEffect(() => {
    const onBlur = () => {
      void stopAll();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [stopAll]);

  const link = activeDevice
    ? describeCameraConnectorLink({
        lastSeenAt: activeDevice.lastSeenAt,
        remoteControlEnabled: activeDevice.remoteControlEnabled,
        revokedAt: activeDevice.revokedAt,
      })
    : { online: false, label: "Not paired", tone: "muted" as const };

  async function startPreview(cameraId: string) {
    if (!canOperate) return;
    if (previewSessionId) {
      await endCameraPreviewAction({ sessionId: previewSessionId });
    }
    const result = await startCameraPreviewAction({ cameraId, mode: "snapshot" });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setPreviewError(null);
    setPreviewSessionId(result.previewSessionId ?? null);
    toast.success("Preview requested — waiting for Mac frames…");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cameras</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Remote preview and PTZ for FloBama cameras through the venue Mac. The connector discovers NDI
          sources on that Mac and merges them with cameras you create here. Ecamm program output stays
          separate from controllable camera sources.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Mac connector</h2>
            <p className="text-sm text-muted-foreground">
              {activeDevice
                ? `${activeDevice.label}${activeDevice.hostname ? ` · ${activeDevice.hostname}` : ""}`
                : "No Mac paired yet."}
            </p>
            <p className="text-sm text-muted-foreground">{formatCameraHeartbeat(activeDevice?.lastSeenAt ?? null)}</p>
            {!link.online && activeDevice && !activeDevice.revokedAt ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No recent heartbeat from this Mac credential. If the menu bar says Connected, reinstall Mac
                Camera {CAMERA_CONNECTOR_VERSION} (or create a new pairing code — older zombie credentials are
                ignored in favor of the newest heartbeat).
              </p>
            ) : null}
            {activeDevice?.statusDetail ? (
              <p className="text-sm text-muted-foreground">Mac status: {activeDevice.statusDetail}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Connector on Mac:{" "}
              <span className="font-mono">{activeDevice?.connectorVersion || "not reported yet"}</span>
              {activeDevice?.connectorVersion &&
              activeDevice.connectorVersion !== CAMERA_CONNECTOR_VERSION ? (
                <span className="text-amber-700 dark:text-amber-400"> · outdated — reinstall below</span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              On the Mac, look for <span className="font-medium">Cam ●</span> in the menu bar while the
              connector is running (click it for NDI names). Local Network must be allowed for{" "}
              <span className="font-medium">FloBama Mac Camera</span> — macOS will not let you add it
              manually; open the app once so it appears in System Settings → Privacy &amp; Security → Local
              Network.
            </p>
          </div>
          <Badge
            variant={link.tone === "ok" ? "default" : "secondary"}
            className={cn(
              link.tone === "error" && "bg-destructive text-destructive-foreground",
              link.tone === "warn" && "bg-amber-600 text-white",
            )}
          >
            {link.label}
          </Badge>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase">NDI sources on Mac</h3>
            <p className="text-xs text-muted-foreground">
              {activeDevice?.discoveredNdi?.length
                ? `${activeDevice.discoveredNdi.length} broadcast source${activeDevice.discoveredNdi.length === 1 ? "" : "s"}`
                : link.online
                  ? "None reported yet"
                  : "Waiting for Mac heartbeat"}
            </p>
          </div>
          {activeDevice?.discoveredNdi && activeDevice.discoveredNdi.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {activeDevice.discoveredNdi.map((source) => (
                <li
                  key={source.sourceKey}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.urlAddress || "No URL address reported"}
                      {" · "}
                      <span className="font-mono">{source.sourceKey}</span>
                    </p>
                  </div>
                  <Badge variant="secondary">Live on LAN</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {link.online
                ? activeDevice?.connectorVersion &&
                  activeDevice.connectorVersion !== CAMERA_CONNECTOR_VERSION
                  ? `Mac is on connector ${activeDevice.connectorVersion}, which cannot report NDI correctly. Reinstall Mac Camera ${CAMERA_CONNECTOR_VERSION} (delete the old app in Applications first).`
                  : "The Mac has not listed any NDI broadcasts yet. Allow Local Network for FloBama Mac Camera, and confirm cameras/Ecamm are publishing NDI on the same LAN."
                : `Pair and start Mac Camera ${CAMERA_CONNECTOR_VERSION} to see LAN NDI source names here.`}
            </p>
          )}
        </div>

        <div className="mt-4">
          <MacCameraDownload connectorVersion={activeDevice?.connectorVersion} />
        </div>

        {canConfigure ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await createCameraPairingCodeAction();
                  if (!result.ok) toast.error(result.message);
                  else {
                    setPairingCode(result.pairingCode ?? null);
                    toast.success(result.message);
                    router.refresh();
                  }
                });
              }}
            >
              {pending ? "Creating…" : "Create pairing code"}
            </Button>
            {activeDevice && !activeDevice.revokedAt ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await revokeCameraDeviceAction({ deviceId: activeDevice.id });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      router.refresh();
                    }
                  });
                }}
              >
                Revoke Mac credential
              </Button>
            ) : null}
          </div>
        ) : null}

        {pairingCode ? (
          <div className="mt-4 rounded-lg border border-dashed bg-muted/40 p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">One-time pairing code</p>
            <p className="mt-1 font-mono text-2xl tracking-[0.25em]">{pairingCode}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              On the Mac: open the FloBama Mac Camera app from the .dmg and enter this code when prompted.
              API base should be{" "}
              <span className="font-mono text-xs">{apiBase || "(set NEXT_PUBLIC_SITE_URL)"}</span>
            </p>
          </div>
        ) : null}
      </section>

      <CameraInventoryForm inventory={inventory} canEdit={canOperate} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Available cameras</h2>
          {cameras.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {link.online
                ? "Mac is online but has not reported cameras yet."
                : "Waiting for the Mac connector. Simulated cameras appear after the connector starts in sim mode."}
            </p>
          ) : (
            <ul className="space-y-2">
              {cameras.map((camera) => {
                const lease = leaseByCamera.get(camera.id);
                const controllable = camera.supportsPtz && !camera.isProgramOutput;
                return (
                  <li
                    key={camera.id}
                    className={cn(
                      "rounded-lg border",
                      resolvedSelectedId === camera.id ? "border-primary bg-primary/5" : "",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(camera.id);
                        if (canOperate) void startPreview(camera.id);
                      }}
                      className={cn(
                        "w-full px-3 py-3 text-left transition-colors",
                        resolvedSelectedId !== camera.id && "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{camera.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {linkStatusLabel(camera.linkStatus)}
                            {camera.connectionTarget ? ` · ${camera.connectionTarget}` : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "mt-1 size-2 shrink-0 rounded-full",
                            camera.online
                              ? "bg-emerald-500"
                              : camera.linkStatus.includes("pending")
                                ? "bg-amber-500"
                                : "bg-muted-foreground/40",
                          )}
                          aria-hidden
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {controllable ? (
                          <Badge variant="secondary">PTZ</Badge>
                        ) : (
                          <Badge variant="outline">Preview only</Badge>
                        )}
                        {camera.isSimulated ? <Badge variant="outline">Simulated</Badge> : null}
                        {camera.supportsZoom ? <Badge variant="secondary">Zoom</Badge> : null}
                        {camera.supportsPresets ? <Badge variant="secondary">Presets</Badge> : null}
                        {lease ? (
                          <Badge variant="outline">
                            {lease.holderUserId === currentUserId ? "You control" : "In use"}
                          </Badge>
                        ) : null}
                      </div>
                      {camera.lastError ? (
                        <p className="mt-2 text-xs text-destructive">{camera.lastError}</p>
                      ) : null}
                    </button>
                    {canOperate ? (
                      <div className="border-t px-3 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm(`Delete “${camera.title}”?`)) return;
                            startTransition(async () => {
                              if (previewSessionId && resolvedSelectedId === camera.id) {
                                await endCameraPreviewAction({ sessionId: previewSessionId });
                                setPreviewSessionId(null);
                              }
                              const result = await deleteCameraSourceAction({ cameraId: camera.id });
                              if (!result.ok) toast.error(result.message);
                              else {
                                toast.success(result.message);
                                if (resolvedSelectedId === camera.id) setSelectedId(null);
                                router.refresh();
                              }
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a camera to preview and control.</p>
          ) : (
            <>
              <div
                className={cn(
                  "rounded-lg border px-4 py-3",
                  iHoldLease ? "border-orange-600/50 bg-orange-500/10" : "bg-muted/30",
                )}
              >
                <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  {iHoldLease ? "You are controlling" : "Selected camera"}
                </p>
                <p className="text-xl font-semibold tracking-tight">{selected.title}</p>
                <p className="text-sm text-muted-foreground">
                  {linkStatusLabel(selected.linkStatus)}
                  {selected.connectionTarget ? ` · target “${selected.connectionTarget}”` : ""}
                </p>
                {selected.lastError ? (
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{selected.lastError}</p>
                ) : selected.linkStatus === "ndi_live" && !selected.supportsPtz ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Discovered on Mac — preview available. Add it in Camera setup with PTZ enabled if this
                    unit supports NDI PTZ.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {selected.isProgramOutput
                    ? "Ecamm/program feed — framing reference only; PTZ is disabled."
                    : selected.linkStatus === "ndi_pending" || selected.linkStatus === "visca_pending"
                      ? "Configured, but not live on the Mac yet. Preview shows identity + status until NDI/VISCA is linked."
                      : selected.supportsPtz
                        ? "Hold the pad to move. The preview label must match this camera name."
                        : "Preview-only source (no PTZ)."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canOperate ? (
                    <Button type="button" variant="outline" onClick={() => void startPreview(selected.id)}>
                      Refresh preview
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">View-only role</p>
                  )}
                  {canOperate ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Delete “${selected.title}”?`)) return;
                        startTransition(async () => {
                          if (previewSessionId) {
                            await endCameraPreviewAction({ sessionId: previewSessionId });
                            setPreviewSessionId(null);
                          }
                          const result = await deleteCameraSourceAction({ cameraId: selected.id });
                          if (!result.ok) toast.error(result.message);
                          else {
                            toast.success(result.message);
                            setSelectedId(null);
                            router.refresh();
                          }
                        });
                      }}
                    >
                      Delete camera
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                {previewSessionId && canOperate ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${previewSessionId}-${previewTick}`}
                      src={`/api/media/v1/cameras/preview/${previewSessionId}?t=${previewTick}`}
                      alt={`Preview of ${selected.title}`}
                      className="h-full w-full object-contain"
                      onLoad={() => setPreviewError(null)}
                      onError={() =>
                        setPreviewError(
                          link.online
                            ? "Waiting for a frame from the Mac connector…"
                            : "Mac Camera app is not heartbeating. Open FloBama Mac Camera on the venue Mac (look for Cam ●), then tap Refresh preview.",
                        )
                      }
                    />
                    {previewError ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white/80">
                        {previewError}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
                    {!link.online
                      ? "Mac Camera app is not heartbeating. Open FloBama Mac Camera on the venue Mac until Cam ● appears, then tap Refresh preview."
                      : canOperate
                        ? "Select a camera or tap Refresh preview."
                        : "Operators can start an authorized preview session."}
                  </div>
                )}
              </div>

              {canOperate && selected.supportsPtz && !selected.isProgramOutput ? (
                <CameraPtzPad
                  speed={speed}
                  speeds={selected.capabilities.speeds}
                  presets={selected.supportsPresets ? selected.capabilities.presetsList : []}
                  supportsZoom={selected.supportsZoom}
                  supportsFocus={selected.supportsFocus}
                  supportsPresetSave={selected.supportsPresetSave}
                  disabled={
                    !link.online ||
                    !activeDevice?.remoteControlEnabled ||
                    selected.linkStatus === "ndi_pending" ||
                    selected.linkStatus === "visca_pending"
                  }
                  onSpeedChange={setSpeed}
                  onCommand={async (kind, payload) => {
                    const result = await issueCameraCommandAction({
                      cameraId: selected.id,
                      kind,
                      payload,
                    } as Parameters<typeof issueCameraCommandAction>[0]);
                    if (!result.ok) toast.error(result.message);
                  }}
                  onStop={() => void stopAll()}
                  onRelease={async () => {
                    const result = await releaseCameraLeaseAction({ cameraId: selected.id });
                    if (!result.ok) toast.error(result.message);
                    else router.refresh();
                  }}
                />
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {selected.isProgramOutput
                    ? "Program output cannot be controlled remotely."
                    : selected.linkStatus === "ndi_pending"
                      ? "NDI camera is configured but not live yet. Confirm the NDI source name and Mac NDI runtime; live control stays disabled until the link is verified."
                      : selected.supportsPtz
                        ? "Connect the Mac connector to enable PTZ."
                        : "This source does not advertise PTZ."}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
