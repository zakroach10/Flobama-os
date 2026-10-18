"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  archiveServerStationOperatorAction,
  clearServerStationPinAction,
  createServerStationOperatorAction,
  createServerStationPairingCodeAction,
  revokeServerStationDeviceAction,
  setServerStationPinAction,
  updateServerStationOperatorPinAction,
} from "@/actions/server-station-auth";
import { updateServerStationSettingsAction } from "@/actions/server-station";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SERVER_STATION_OPERATORS_SQL, SERVER_STATION_SQL } from "@/lib/constants";
import type { ServerStationSettings } from "@/lib/server-station/settings";

type SceneOption = { id: string; title: string; server_approved: boolean; artist_id: string | null };
type PlaylistOption = { id: string; name: string };
type DeviceRow = { id: string; label: string; last_seen_at: string | null; revoked_at: string | null };
type StaffPinOption = { userId: string; displayName: string; hasPin: boolean };
type OperatorOption = { id: string; displayName: string };
type AuditRow = { id: string; actor_name: string | null; action: string; created_at: string };

export function ServerStationAdminPanel({
  settings,
  scenes,
  playlists,
  devices,
  staffOptions,
  operators,
  operatorsMissing,
  audit,
  missingTable,
  canManage,
}: {
  settings: ServerStationSettings;
  scenes: SceneOption[];
  playlists: PlaylistOption[];
  devices: DeviceRow[];
  staffOptions: StaffPinOption[];
  operators: OperatorOption[];
  operatorsMissing: boolean;
  audit: AuditRow[];
  missingTable: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNowEnabled, setShowNowEnabled] = useState(settings.show_now_enabled);
  const [birthdayApprovalRequired, setBirthdayApprovalRequired] = useState(
    settings.birthday_approval_required,
  );
  const [temporaryPlaylistId, setTemporaryPlaylistId] = useState(settings.temporary_playlist_id ?? "");
  const [defaultSlideSeconds, setDefaultSlideSeconds] = useState(String(settings.default_slide_seconds));
  const [defaultOverrideMinutes, setDefaultOverrideMinutes] = useState(
    String(settings.default_override_minutes),
  );
  const [maxUploadMb, setMaxUploadMb] = useState(String(Math.round(settings.max_upload_bytes / (1024 * 1024))));
  const [businessNightEndHour, setBusinessNightEndHour] = useState(String(settings.business_night_end_hour));
  const [staffIdleSeconds, setStaffIdleSeconds] = useState(String(settings.staff_idle_seconds));
  const houseScenes = useMemo(() => scenes.filter((scene) => !scene.artist_id), [scenes]);
  const [approved, setApproved] = useState(
    () => new Set(houseScenes.filter((s) => s.server_approved).map((s) => s.id)),
  );
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pinUserId, setPinUserId] = useState(staffOptions[0]?.userId ?? "");
  const [pin, setPin] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [operatorPin, setOperatorPin] = useState("");
  const [operatorPinDrafts, setOperatorPinDrafts] = useState<Record<string, string>>({});

  const approvedIds = useMemo(() => [...approved], [approved]);

  if (missingTable) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Server Station</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code>{SERVER_STATION_SQL}</code> (after the server role migration) to enable kiosk settings,
          PINs, and temporary LED content.
        </p>
      </section>
    );
  }

  if (!canManage) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Server Station</h2>
        <p className="text-sm text-muted-foreground">Only admins can configure Server Station.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Server Station</h2>
        <p className="text-sm text-muted-foreground">
          Configure the floor kiosk, approved LED scenes, temporary slide defaults, and who can sign in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={showNowEnabled}
            onChange={(event) => setShowNowEnabled(event.target.checked)}
          />
          Allow Show Now
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={birthdayApprovalRequired}
            onChange={(event) => setBirthdayApprovalRequired(event.target.checked)}
          />
          Require approval for birthday/celebration messages
        </label>
        <div className="space-y-2">
          <Label>Temporary content playlist</Label>
          <select
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={temporaryPlaylistId}
            onChange={(event) => setTemporaryPlaylistId(event.target.value)}
          >
            <option value="">Default house ads playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Default slide seconds</Label>
          <Input value={defaultSlideSeconds} onChange={(event) => setDefaultSlideSeconds(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Default Show Now minutes</Label>
          <Input
            value={defaultOverrideMinutes}
            onChange={(event) => setDefaultOverrideMinutes(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Max upload size (MB)</Label>
          <Input value={maxUploadMb} onChange={(event) => setMaxUploadMb(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Business night end hour (0–6)</Label>
          <Input
            value={businessNightEndHour}
            onChange={(event) => setBusinessNightEndHour(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Staff idle lock (seconds)</Label>
          <Input value={staffIdleSeconds} onChange={(event) => setStaffIdleSeconds(event.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">House scenes servers can activate</h3>
        <p className="text-sm text-muted-foreground">
          All artist LED graphics are available on Server Station automatically. Only pick extra house /
          OBS scenes here — no scrolling through the artist roster.
        </p>
        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
          {houseScenes.map((scene) => (
            <label key={scene.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={approved.has(scene.id)}
                onChange={(event) => {
                  setApproved((prev) => {
                    const next = new Set(prev);
                    if (event.target.checked) next.add(scene.id);
                    else next.delete(scene.id);
                    return next;
                  });
                }}
              />
              {scene.title}
            </label>
          ))}
          {!houseScenes.length ? (
            <p className="text-sm text-muted-foreground">No house LED scenes yet.</p>
          ) : null}
        </div>
      </div>

      <Button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await updateServerStationSettingsAction({
              showNowEnabled,
              birthdayApprovalRequired,
              temporaryPlaylistId: temporaryPlaylistId || null,
              defaultSlideSeconds: Number(defaultSlideSeconds),
              defaultOverrideMinutes: Number(defaultOverrideMinutes),
              maxUploadBytes: Number(maxUploadMb) * 1024 * 1024,
              businessNightEndHour: Number(businessNightEndHour),
              staffIdleSeconds: Number(staffIdleSeconds),
              approvedSceneIds: approvedIds,
            });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              router.refresh();
            }
          });
        }}
      >
        Save Server Station settings
      </Button>

      <div className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Kiosk devices</h3>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await createServerStationPairingCodeAction({ label: "Server Station" });
              if (!result.ok) toast.error(result.message);
              else {
                setPairingCode(result.code ?? null);
                toast.success(result.message);
              }
            });
          }}
        >
          Create pairing code
        </Button>
        {pairingCode ? (
          <p className="rounded-lg border bg-muted/40 px-4 py-3 font-mono text-2xl tracking-[0.25em]">
            {pairingCode}
          </p>
        ) : null}
        <div className="space-y-2">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{device.label}</p>
                <p className="text-muted-foreground">
                  {device.revoked_at
                    ? "Revoked"
                    : device.last_seen_at
                      ? `Last seen ${new Date(device.last_seen_at).toLocaleString()}`
                      : "Never seen"}
                </p>
              </div>
              {!device.revoked_at ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await revokeServerStationDeviceAction({ deviceId: device.id });
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
              ) : null}
            </div>
          ))}
          {!devices.length ? <p className="text-sm text-muted-foreground">No kiosks paired yet.</p> : null}
        </div>
      </div>

      <div className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Kiosk logins</h3>
        <p className="text-sm text-muted-foreground">
          A name and a 4–6 digit PIN. These people can use the floor station without a full staff account.
        </p>
        {operatorsMissing ? (
          <p className="text-sm text-muted-foreground">
            Apply <code>{SERVER_STATION_OPERATORS_SQL}</code> in the Supabase SQL editor to turn on name-and-PIN
            logins. Staff PINs below keep working.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <Input
                placeholder="Name on the kiosk"
                value={operatorName}
                maxLength={40}
                onChange={(event) => setOperatorName(event.target.value)}
              />
              <Input
                type="password"
                inputMode="numeric"
                placeholder="4–6 digit PIN"
                value={operatorPin}
                onChange={(event) => setOperatorPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <Button
                disabled={pending || !operatorName.trim() || operatorPin.length < 4}
                onClick={() => {
                  startTransition(async () => {
                    const result = await createServerStationOperatorAction({
                      displayName: operatorName,
                      pin: operatorPin,
                    });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      setOperatorName("");
                      setOperatorPin("");
                      router.refresh();
                    }
                  });
                }}
              >
                Add login
              </Button>
            </div>
            <div className="space-y-2">
              {operators.map((operator) => (
                <div key={operator.id} className="grid gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-center">
                  <p className="font-medium">{operator.displayName}</p>
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="New PIN"
                    value={operatorPinDrafts[operator.id] ?? ""}
                    onChange={(event) =>
                      setOperatorPinDrafts((current) => ({
                        ...current,
                        [operator.id]: event.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || (operatorPinDrafts[operator.id]?.length ?? 0) < 4}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await updateServerStationOperatorPinAction({
                          operatorId: operator.id,
                          pin: operatorPinDrafts[operator.id] ?? "",
                        });
                        if (!result.ok) toast.error(result.message);
                        else {
                          toast.success(result.message);
                          setOperatorPinDrafts((current) => ({ ...current, [operator.id]: "" }));
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Update PIN
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await archiveServerStationOperatorAction({ operatorId: operator.id });
                        if (!result.ok) toast.error(result.message);
                        else {
                          toast.success(result.message);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {!operators.length ? (
                <p className="text-sm text-muted-foreground">No name-and-PIN logins yet.</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Staff PINs</h3>
        <p className="text-sm text-muted-foreground">
          For people who already have an Admin, Manager, or Server account.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="flex h-10 rounded-md border bg-background px-3 text-sm"
            value={pinUserId}
            onChange={(event) => setPinUserId(event.target.value)}
          >
            {staffOptions.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.displayName}
                {person.hasPin ? " · PIN set" : ""}
              </option>
            ))}
          </select>
          <Input
            type="password"
            inputMode="numeric"
            placeholder="4–6 digit PIN"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <div className="flex gap-2">
            <Button
              disabled={pending || !pinUserId}
              onClick={() => {
                startTransition(async () => {
                  const result = await setServerStationPinAction({ userId: pinUserId, pin });
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    setPin("");
                    router.refresh();
                  }
                });
              }}
            >
              Save PIN
            </Button>
            <Button
              variant="outline"
              disabled={pending || !pinUserId}
              onClick={() => {
                startTransition(async () => {
                  const result = await clearServerStationPinAction({ userId: pinUserId });
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    router.refresh();
                  }
                });
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Recent activity</h3>
        <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
          {audit.map((row) => (
            <div key={row.id} className="rounded-lg border px-3 py-2">
              <p className="font-medium">
                {row.actor_name || "Staff"} · {row.action}
              </p>
              <p className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
            </div>
          ))}
          {!audit.length ? <p className="text-muted-foreground">No Server Station activity yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
