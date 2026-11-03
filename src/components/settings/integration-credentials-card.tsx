"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createIntegrationCredentialAction,
  revokeIntegrationCredentialAction,
} from "@/actions/integration-credentials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IntegrationScope } from "@/lib/integrations/contract";
import { INTEGRATION_SCOPES } from "@/lib/integrations/contract";
import {
  DEFAULT_AI_STUDIO_SCOPES,
  INTEGRATION_SCOPE_LABELS,
  type StaffIntegrationCredential,
} from "@/lib/integrations/credentials-admin";

function formatWhen(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

export function IntegrationCredentialsCard({
  credentials,
  canManage,
  serviceRoleConfigured,
  apiBaseUrl,
  loadError,
}: {
  credentials: StaffIntegrationCredential[];
  canManage: boolean;
  serviceRoleConfigured: boolean;
  apiBaseUrl: string;
  loadError: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("HighLevel AI Studio");
  const [scopes, setScopes] = useState<IntegrationScope[]>(DEFAULT_AI_STUDIO_SCOPES);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const active = useMemo(() => credentials.filter((row) => !row.revokedAt), [credentials]);
  const revoked = useMemo(() => credentials.filter((row) => row.revokedAt), [credentials]);

  function toggleScope(scope: IntegrationScope) {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Legacy event manager API</h3>
        <Badge variant={active.length > 0 ? "default" : "secondary"}>
          {active.length > 0 ? `${active.length} active token${active.length === 1 ? "" : "s"}` : "No active token"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Generate a server-to-server token for HighLevel AI Studio. FloBama OS stores only a hash. The full token is
        shown once here — put it in AI Studio&apos;s server env as <code>FLOBAMA_OS_INTEGRATION_TOKEN</code>, never in
        the browser app.
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">API base URL</dt>
          <dd className="break-all font-mono text-xs">{apiBaseUrl}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">AI Studio env</dt>
          <dd className="font-mono text-xs">FLOBAMA_OS_API_BASE_URL</dd>
        </div>
      </dl>

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      {!serviceRoleConfigured ? (
        <p className="text-sm text-muted-foreground">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> on the FloBama OS server before creating or revoking tokens.
        </p>
      ) : null}

      {canManage && serviceRoleConfigured ? (
        <form
          className="space-y-4 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await createIntegrationCredentialAction({ name, scopes });
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              setRevealedToken(result.token ?? null);
              toast.success(result.message);
              router.refresh();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="integration-credential-name">Name</Label>
            <Input
              id="integration-credential-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Permissions</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {INTEGRATION_SCOPES.map((scope) => (
                <label key={scope} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  <span>
                    <span className="font-medium">{INTEGRATION_SCOPE_LABELS[scope]}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{scope}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={pending || scopes.length === 0}>
            {pending ? "Creating…" : "Generate token"}
          </Button>
        </form>
      ) : canManage ? null : (
        <p className="text-sm text-muted-foreground">Only admins can generate or revoke integration tokens.</p>
      )}

      {revealedToken ? (
        <div className="space-y-3 rounded-lg border border-dashed bg-muted/40 p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Copy this token now
          </p>
          <p className="break-all font-mono text-sm">{revealedToken}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(revealedToken);
                  toast.success("Token copied.");
                } catch {
                  toast.error("Could not copy. Select the token and copy it manually.");
                }
              }}
            >
              Copy token
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRevealedToken(null)}>
              Hide token
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            AI Studio server settings:
            <br />
            <code>FLOBAMA_OS_API_BASE_URL={apiBaseUrl}</code>
            <br />
            <code>FLOBAMA_OS_INTEGRATION_TOKEN=&lt;paste token&gt;</code>
          </p>
        </div>
      ) : null}

      {active.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No active integration credentials yet.</p>
      ) : (
        <ul className="space-y-3">
          {active.map((credential) => (
            <li key={credential.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{credential.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {credential.tokenPrefix}… · {credential.scopes.join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatWhen(credential.createdAt)} · Last used {formatWhen(credential.lastUsedAt)}
                  </p>
                </div>
                {canManage && serviceRoleConfigured ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Revoke “${credential.name}”? AI Studio will stop working until you mint a new token.`)) {
                        return;
                      }
                      startTransition(async () => {
                        const result = await revokeIntegrationCredentialAction({
                          credentialId: credential.id,
                        });
                        if (!result.ok) toast.error(result.message);
                        else {
                          toast.success(result.message);
                          setRevealedToken(null);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {revoked.length > 0 ? (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Revoked credentials ({revoked.length})</summary>
          <ul className="mt-2 space-y-2">
            {revoked.map((credential) => (
              <li key={credential.id} className="rounded-lg border border-dashed p-3">
                <p className="font-medium text-foreground">{credential.name}</p>
                <p className="font-mono text-xs">
                  {credential.tokenPrefix}… · revoked {formatWhen(credential.revokedAt)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
