"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  processSpotOnWebhookQueueAction,
  replaySpotOnWebhookAction,
  runSpotOnBackfillAction,
  runSpotOnManualSyncAction,
  runSpotOnMenuSyncAction,
  testSpotOnConnectionAction,
  updateSpotOnSettingsAction,
} from "@/actions/spoton";
import { formatCapabilityLabel } from "@/lib/spoton/status";
import type { SpotOnApiProduct, SpotOnCapabilityStatus } from "@/lib/spoton/types";

export type SpotOnIntegrationsCardProps = {
  canManage: boolean;
  webhookUrl: string;
  settings: {
    apiProduct: SpotOnApiProduct;
    locationId: string | null;
    businessDayCutoffLocal: string;
    eventWindowPreMinutes: number;
    eventWindowPostMinutes: number;
    syncEnabled: boolean;
    publishMappedMenu: boolean;
    notes: string | null;
    lastWebhookAt: string | null;
    lastWebhookEventId: string | null;
    lastProcessedEventId: string | null;
    lastProcessedEventAt: string | null;
    lastSuccessfulSyncAt: string | null;
    coverageThrough: string | null;
    lastConnectionTestAt: string | null;
    lastConnectionTestOk: boolean | null;
    lastConnectionTestMessage: string | null;
  };
  capabilities: {
    webhook: SpotOnCapabilityStatus;
    reporting: SpotOnCapabilityStatus;
    menu: SpotOnCapabilityStatus;
  };
  credentials: {
    locationId: boolean;
    restaurantExportApiKey: boolean;
    centralClientId: boolean;
    centralClientSecret: boolean;
    webhookSignatureKey: boolean;
  };
  recentRuns: Array<{
    id: string;
    kind: string;
    status: string;
    createdAt: string;
    errorSafe: string | null;
  }>;
  recentWebhooks: Array<{
    id: string;
    eventId: string;
    category: string;
    status: string;
    createdAt: string;
    error: string | null;
  }>;
};

function CredIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="font-mono text-xs">{label}</span>
      <Badge variant={ok ? "default" : "secondary"}>{ok ? "Configured" : "Missing"}</Badge>
    </li>
  );
}

function statusVariant(status: SpotOnCapabilityStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "verified") return "default";
  if (status === "permission_denied") return "destructive";
  if (status === "configured_unverified") return "outline";
  return "secondary";
}

export function SpotOnIntegrationsCard(props: SpotOnIntegrationsCardProps) {
  const [pending, startTransition] = useTransition();
  const [apiProduct, setApiProduct] = useState<SpotOnApiProduct>(props.settings.apiProduct);
  const [locationId, setLocationId] = useState(props.settings.locationId ?? "");
  const [cutoff, setCutoff] = useState(props.settings.businessDayCutoffLocal.slice(0, 5));
  const [preMinutes, setPreMinutes] = useState(String(props.settings.eventWindowPreMinutes));
  const [postMinutes, setPostMinutes] = useState(String(props.settings.eventWindowPostMinutes));
  const [syncEnabled, setSyncEnabled] = useState(props.settings.syncEnabled);
  const [publishMappedMenu, setPublishMappedMenu] = useState(props.settings.publishMappedMenu);
  const [backfillStart, setBackfillStart] = useState("");
  const [backfillEnd, setBackfillEnd] = useState("");

  const reportingDisabled = props.capabilities.reporting !== "verified";
  const setupLabel = useMemo(() => {
    if (
      props.capabilities.webhook === "not_configured" &&
      props.capabilities.reporting === "not_configured" &&
      props.capabilities.menu === "not_configured"
    ) {
      return "Not configured";
    }
    if (
      props.capabilities.reporting === "verified" ||
      props.capabilities.webhook === "verified" ||
      props.capabilities.menu === "verified"
    ) {
      return "Partially or fully verified";
    }
    return "Configured (unverified)";
  }, [props.capabilities]);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">SpotOn</h3>
        <Badge variant="secondary">{setupLabel}</Badge>
        <Badge variant={statusVariant(props.capabilities.webhook)}>
          Webhook: {formatCapabilityLabel(props.capabilities.webhook)}
        </Badge>
        <Badge variant={statusVariant(props.capabilities.reporting)}>
          Reporting: {formatCapabilityLabel(props.capabilities.reporting)}
        </Badge>
        <Badge variant={statusVariant(props.capabilities.menu)}>
          Menu: {formatCapabilityLabel(props.capabilities.menu)}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        SpotOn remains the source of truth for POS transactions. This integration reads sales, menu, and
        availability data. A working webhook does not grant reporting or historical orders. Credentials stay in
        server environment variables — never in the browser.
      </p>

      <div className="space-y-2">
        <Label>Webhook URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={props.webhookUrl} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            disabled={!props.canManage}
            onClick={async () => {
              await navigator.clipboard.writeText(props.webhookUrl);
              toast.success("Webhook URL copied");
            }}
          >
            Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Subscribe in SpotOn using Central API webhook delivery. Signature key goes in{" "}
          <code>SPOTON_WEBHOOK_SIGNATURE_KEY</code>. No unsigned production fallback.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium">Server credentials</p>
        <ul className="mt-2 space-y-1">
          <CredIndicator ok={props.credentials.locationId} label="SPOTON_LOCATION_ID" />
          <CredIndicator
            ok={props.credentials.webhookSignatureKey}
            label="SPOTON_WEBHOOK_SIGNATURE_KEY"
          />
          <CredIndicator
            ok={props.credentials.restaurantExportApiKey}
            label="SPOTON_RESTAURANT_EXPORT_API_KEY"
          />
          <CredIndicator ok={props.credentials.centralClientId} label="SPOTON_CENTRAL_CLIENT_ID" />
          <CredIndicator
            ok={props.credentials.centralClientSecret}
            label="SPOTON_CENTRAL_CLIENT_SECRET"
          />
        </ul>
      </div>

      {props.canManage ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() =>
              updateSpotOnSettingsAction({
                apiProduct,
                locationId: locationId || null,
                businessDayCutoffLocal: cutoff,
                eventWindowPreMinutes: Number(preMinutes),
                eventWindowPostMinutes: Number(postMinutes),
                syncEnabled,
                publishMappedMenu,
              }),
            );
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="spoton-api-product">Reporting API product</Label>
            <select
              id="spoton-api-product"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={apiProduct}
              onChange={(e) => setApiProduct(e.target.value as SpotOnApiProduct)}
            >
              <option value="none">None (webhook-only inspection)</option>
              <option value="restaurant_export">Restaurant Export API (RPOS)</option>
              <option value="central_api">Central API reporting</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spoton-location">Mapped location id (display)</Label>
            <Input
              id="spoton-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Must match SPOTON_LOCATION_ID"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spoton-cutoff">Business-day cutoff (local)</Label>
            <Input id="spoton-cutoff" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spoton-pre">Event window pre (minutes)</Label>
            <Input id="spoton-pre" value={preMinutes} onChange={(e) => setPreMinutes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spoton-post">Event window post (minutes)</Label>
            <Input id="spoton-post" value={postMinutes} onChange={(e) => setPostMinutes(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
            />
            Enable scheduled incremental sync
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={publishMappedMenu}
              onChange={(e) => setPublishMappedMenu(e.target.checked)}
            />
            Publish explicitly mapped menu items to the public menu API
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save settings
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Only admins can change SpotOn settings.</p>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Last authenticated webhook</dt>
          <dd>{props.settings.lastWebhookAt ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last processed event</dt>
          <dd>{props.settings.lastProcessedEventId ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last successful sync</dt>
          <dd>{props.settings.lastSuccessfulSyncAt ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Coverage through</dt>
          <dd>{props.settings.coverageThrough ?? "Unavailable"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Last connection test</dt>
          <dd>
            {props.settings.lastConnectionTestAt
              ? `${props.settings.lastConnectionTestOk ? "OK" : "Failed"} — ${props.settings.lastConnectionTestMessage}`
              : "Unavailable"}
          </dd>
        </div>
      </dl>

      {props.canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(testSpotOnConnectionAction)}>
            Test connection
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || reportingDisabled}
            onClick={() => run(runSpotOnManualSyncAction)}
          >
            Manual sync
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || props.capabilities.menu === "not_configured"}
            onClick={() => run(runSpotOnMenuSyncAction)}
          >
            Sync menus
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(processSpotOnWebhookQueueAction)}
          >
            Process webhook queue
          </Button>
        </div>
      ) : null}

      {reportingDisabled ? (
        <p className="text-sm text-muted-foreground">
          Reporting features stay disabled until a reporting API product is selected and a read-only connection
          test succeeds. Webhook-only mode still receives and inspects supported events.
        </p>
      ) : null}

      {props.canManage ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            type="datetime-local"
            value={backfillStart}
            onChange={(e) => setBackfillStart(e.target.value)}
            disabled={reportingDisabled || pending}
          />
          <Input
            type="datetime-local"
            value={backfillEnd}
            onChange={(e) => setBackfillEnd(e.target.value)}
            disabled={reportingDisabled || pending}
          />
          <Button
            type="button"
            variant="outline"
            disabled={reportingDisabled || pending || !backfillStart || !backfillEnd}
            onClick={() => {
              const startIso = new Date(backfillStart).toISOString();
              const endIso = new Date(backfillEnd).toISOString();
              run(() => runSpotOnBackfillAction({ startIso, endIso }));
            }}
          >
            Backfill
          </Button>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium">Recent jobs</p>
        <ul className="mt-2 space-y-1 text-sm">
          {props.recentRuns.length === 0 ? (
            <li className="text-muted-foreground">No jobs yet</li>
          ) : (
            props.recentRuns.map((runRow) => (
              <li key={runRow.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{runRow.kind}</span>
                <Badge variant="outline">{runRow.status}</Badge>
                <span className="text-xs text-muted-foreground">{runRow.createdAt}</span>
                {runRow.errorSafe ? <span className="text-xs text-destructive">{runRow.errorSafe}</span> : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium">Recent webhooks</p>
        <ul className="mt-2 space-y-1 text-sm">
          {props.recentWebhooks.length === 0 ? (
            <li className="text-muted-foreground">No webhook events yet</li>
          ) : (
            props.recentWebhooks.map((hook) => (
              <li key={hook.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{hook.category}</span>
                <Badge variant="outline">{hook.status}</Badge>
                <span className="text-xs text-muted-foreground">{hook.eventId}</span>
                {props.canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => replaySpotOnWebhookAction(hook.id))}
                  >
                    Replay
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
