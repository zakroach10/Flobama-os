"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCameraPairingCodeAction,
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
import type { StaffCameraDevice, StaffCameraSource } from "@/lib/cameras/types";
import { describeCameraConnectorLink, formatCameraHeartbeat } from "@/lib/cameras/status";
import { CameraPtzPad } from "@/components/cameras/camera-ptz-pad";
import { MacCameraDownload } from "@/components/cameras/mac-camera-download";
import { cn } from "@/lib/utils";

export function CamerasWorkspace({
  devices,
  cameras,
  leases,
  currentUserId,
  canOperate,
  canConfigure,
  apiBase,
}: {
  devices: StaffCameraDevice[];
  cameras: StaffCameraSource[];
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
  const resolvedSelectedId =
    selectedId && cameras.some((camera) => camera.id === selectedId) ? selectedId : (cameras[0]?.id ?? null);
  const selected = cameras.find((camera) => camera.id === resolvedSelectedId) ?? null;
  const activeDevice = devices.find((device) => !device.revokedAt) ?? devices[0] ?? null;
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
    setPreviewSessionId(result.previewSessionId ?? null);
    toast.success("Preview requested");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cameras</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Remote preview and PTZ for FloBama cameras through the venue Mac. Ecamm program output stays
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

        <div className="mt-4">
          <MacCameraDownload />
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
                  <li key={camera.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(camera.id);
                        if (canOperate) void startPreview(camera.id);
                      }}
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        resolvedSelectedId === camera.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{camera.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {camera.isSimulated ? "Simulated · " : ""}
                            {camera.isProgramOutput ? "Program output · preview only" : camera.protocol}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "mt-1 size-2 shrink-0 rounded-full",
                            camera.online ? "bg-emerald-500" : "bg-muted-foreground/40",
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.isProgramOutput
                      ? "Ecamm/program feed — framing reference only; PTZ is disabled."
                      : selected.supportsPtz
                        ? "Controllable camera"
                        : "Preview-only source (no PTZ reported)"}
                  </p>
                </div>
                {canOperate ? (
                  <Button type="button" variant="outline" onClick={() => void startPreview(selected.id)}>
                    Refresh preview
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">View-only role</p>
                )}
              </div>

              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                {previewSessionId && canOperate ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${previewSessionId}-${previewTick}`}
                    src={`/api/media/v1/cameras/preview/${previewSessionId}?t=${previewTick}`}
                    alt={`Preview of ${selected.title}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
                    {!link.online
                      ? "Mac connector offline — reconnect to preview."
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
                  disabled={!link.online || !activeDevice?.remoteControlEnabled}
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
                    : selected.supportsPtz
                      ? "Connect the Mac connector to enable PTZ."
                      : "This source does not advertise PTZ. Hardware adapters will activate once the camera model and protocol are confirmed."}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
