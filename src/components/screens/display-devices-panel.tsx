"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDisplayPairingCodeAction,
  requestDisplaySafeRefreshAction,
  revokeDisplayDeviceAction,
} from "@/actions/display-devices";
import { setHostedPublicPlaybackAction } from "@/actions/display-signals";
import { LocalRunnerDownload } from "@/components/screens/local-runner-download";
import { Button } from "@/components/ui/button";
import {
  DISPLAY_DEVICE_KIND_LABELS,
  isDisplayDeviceStale,
  type DisplayDeviceKind,
  type StaffDisplayDevice,
} from "@/lib/display-devices/types";
import { HOSTED_PUBLIC_PLAYBACK_SQL } from "@/lib/constants";

function formatBytes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

export function DisplayDevicesPanel({
  devices,
  missingTable,
  canConfigure,
  apiBase,
  hostedLedPublicEnabled = true,
  hostedVerticalPublicEnabled = true,
  signalsMissingTable = false,
}: {
  devices: StaffDisplayDevice[];
  missingTable: boolean;
  canConfigure: boolean;
  apiBase: string;
  hostedLedPublicEnabled?: boolean;
  hostedVerticalPublicEnabled?: boolean;
  signalsMissingTable?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingKind, setPairingKind] = useState<DisplayDeviceKind>("led_runner");

  const live = devices.filter((device) => !device.revoked_at);
  const revoked = devices.filter((device) => device.revoked_at);

  if (missingTable) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Display devices</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Apply the display devices migration in Supabase, then reload Screens to pair Local Runner and Vertical
          Player devices.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Display devices</h2>
        <p className="text-sm text-muted-foreground">
          Pair the booth Mac Local Runner and vertical kiosk players. Devices download assigned media once and
          play from local cache.
        </p>
      </div>

      <LocalRunnerDownload />

      {canConfigure ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Hosted public display URLs</h3>
            <p className="text-sm text-muted-foreground">
              Turn these off after OBS points at Local Runner so old{" "}
              <code className="text-xs">/display/led</code> and{" "}
              <code className="text-xs">/display/vertical</code> tabs stop streaming Supabase media.
              Local Runner pairing and downloads stay on.
            </p>
          </div>
          {signalsMissingTable ? (
            <p className="text-sm text-amber-800">
              Apply <code className="text-xs">{HOSTED_PUBLIC_PLAYBACK_SQL}</code> in Supabase to enable these
              toggles.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={hostedLedPublicEnabled ? "outline" : "default"}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await setHostedPublicPlaybackAction({
                      surface: "led",
                      enabled: !hostedLedPublicEnabled,
                    });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      router.refresh();
                    }
                  });
                }}
              >
                {hostedLedPublicEnabled ? "Turn off hosted LED" : "Turn on hosted LED"}
              </Button>
              <Button
                type="button"
                variant={hostedVerticalPublicEnabled ? "outline" : "default"}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await setHostedPublicPlaybackAction({
                      surface: "vertical",
                      enabled: !hostedVerticalPublicEnabled,
                    });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      router.refresh();
                    }
                  });
                }}
              >
                {hostedVerticalPublicEnabled ? "Turn off hosted vertical" : "Turn on hosted vertical"}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            LED:{" "}
            <span className={hostedLedPublicEnabled ? "text-amber-700" : "text-emerald-700"}>
              {hostedLedPublicEnabled ? "public /display/led ON" : "public /display/led OFF"}
            </span>
            {" · "}
            Vertical:{" "}
            <span className={hostedVerticalPublicEnabled ? "text-amber-700" : "text-emerald-700"}>
              {hostedVerticalPublicEnabled ? "public /display/vertical ON" : "public /display/vertical OFF"}
            </span>
          </p>
        </div>
      ) : null}

      {canConfigure ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Device kind</span>
            <select
              className="flex h-10 min-w-[12rem] rounded-md border bg-background px-3"
              value={pairingKind}
              onChange={(event) => setPairingKind(event.target.value as DisplayDeviceKind)}
            >
              <option value="led_runner">{DISPLAY_DEVICE_KIND_LABELS.led_runner}</option>
              <option value="vertical_kiosk">{DISPLAY_DEVICE_KIND_LABELS.vertical_kiosk}</option>
              <option value="production_runner">{DISPLAY_DEVICE_KIND_LABELS.production_runner}</option>
            </select>
          </label>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await createDisplayPairingCodeAction({ kind: pairingKind });
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
        </div>
      ) : null}

      {pairingCode ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            One-time pairing code
          </p>
          <p className="mt-1 font-mono text-2xl tracking-[0.25em]">{pairingCode}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter this code on the device within 10 minutes. API base:{" "}
            <span className="font-mono text-xs">{apiBase || "(set NEXT_PUBLIC_SITE_URL)"}</span>
          </p>
        </div>
      ) : null}

      {live.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active display devices yet.</p>
      ) : (
        <ul className="space-y-3">
          {live.map((device) => {
            const online = !isDisplayDeviceStale(device.last_seen_at);
            const pendingDownloads = device.status?.assets_pending ?? 0;
            return (
              <li key={device.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{device.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {DISPLAY_DEVICE_KIND_LABELS[device.kind]}
                      {device.app_version ? ` · v${device.app_version}` : ""}
                      {device.hostname ? ` · ${device.hostname}` : ""}
                    </p>
                    <p className="text-sm">
                      <span className={online ? "text-emerald-700" : "text-amber-700"}>
                        {online ? "Online" : "Offline"}
                      </span>
                      {device.status?.playback_state ? ` · ${device.status.playback_state}` : ""}
                      {device.status?.current_asset_id ? ` · playing ${device.status.current_asset_id}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cache {formatBytes(device.status?.cache_bytes)} / {formatBytes(device.status?.cache_limit_bytes)}
                      {pendingDownloads > 0 ? ` · ${pendingDownloads} downloading` : ""}
                      {device.status?.manifest_revision
                        ? ` · rev ${device.status.manifest_revision.slice(0, 24)}…`
                        : ""}
                    </p>
                    {device.status?.last_error ? (
                      <p className="text-xs text-destructive">{device.status.last_error}</p>
                    ) : null}
                  </div>
                  {canConfigure ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await requestDisplaySafeRefreshAction({ deviceId: device.id });
                            if (!result.ok) toast.error(result.message);
                            else toast.success(result.message);
                          });
                        }}
                      >
                        Safe refresh
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await revokeDisplayDeviceAction({ deviceId: device.id });
                            if (!result.ok) toast.error(result.message);
                            else {
                              toast.success(result.message);
                              router.refresh();
                            }
                          });
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {revoked.length > 0 ? (
        <p className="text-xs text-muted-foreground">{revoked.length} revoked device(s) retained for history.</p>
      ) : null}
    </section>
  );
}
