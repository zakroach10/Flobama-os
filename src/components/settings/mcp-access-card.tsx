"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generateMcpAccessKeyAction,
  revokeMcpAccessKeyAction,
  rotateMcpAccessKeyAction,
} from "@/actions/mcp-access";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type McpAccessCardStatus = {
  configured: boolean;
  last4: string | null;
  createdAt: string | null;
  createdByName: string | null;
  lastUsedAt: string | null;
  missingTable: boolean;
};

function formatWhen(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

export function McpAccessCard({
  endpointUrl,
  status,
  serviceRoleConfigured,
  initialRevealedKey = null,
}: {
  endpointUrl: string;
  status: McpAccessCardStatus;
  serviceRoleConfigured: boolean;
  initialRevealedKey?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(initialRevealedKey);
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  }

  function run(task: () => Promise<{ ok: boolean; message: string; token?: string }>) {
    startTransition(async () => {
      const result = await task();
      setConfirm(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.token) setRevealed(result.token);
      else setRevealed(null);
      toast.success(result.message);
      router.refresh();
    });
  }

  const masked = status.last4 ? `fbmcp_••••••••${status.last4}` : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">MCP access (Grok Bot)</h2>
        <p className="text-sm text-muted-foreground">
          One key lets Grok Bot manage FloBama OS. FloBama stores only a hash. The full key is shown once, right after
          you generate or rotate it.
        </p>
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Endpoint</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={endpointUrl} className="font-mono text-xs" aria-label="MCP endpoint URL" />
            <Button type="button" variant="outline" onClick={() => void copy(endpointUrl, "endpoint")}>
              Copy
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            In Grok Bot, add a custom connector with header <code>Authorization: Bearer &lt;key&gt;</code>.
          </p>
        </div>

        {status.missingTable ? (
          <p className="text-sm text-muted-foreground">
            Apply <code>supabase/migrations/20261109000068_mcp_access_keys.sql</code> in the Supabase SQL editor, then
            reload Settings.
          </p>
        ) : null}
        {!serviceRoleConfigured ? (
          <p className="text-sm text-muted-foreground">
            Set <code>SUPABASE_SERVICE_ROLE_KEY</code> on the server before generating a key.
          </p>
        ) : null}

        {revealed ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">New key</p>
            <p className="text-sm text-muted-foreground">Copy it now. Reloading this page hides it.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={revealed} className="font-mono text-xs" aria-label="MCP access key" />
              <Button type="button" onClick={() => void copy(revealed, "MCP key")}>
                Copy
              </Button>
            </div>
          </div>
        ) : status.configured && masked ? (
          <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Key</dt>
              <dd className="font-mono text-xs">{masked}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatWhen(status.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created by</dt>
              <dd>{status.createdByName || "Admin"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last used</dt>
              <dd>{formatWhen(status.lastUsedAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="border-t pt-4 text-sm text-muted-foreground">No MCP key yet.</p>
        )}

        {serviceRoleConfigured && !status.missingTable ? (
          <div className="flex flex-wrap gap-2">
            {!status.configured ? (
              <Button type="button" disabled={pending} onClick={() => run(() => generateMcpAccessKeyAction())}>
                {pending ? "Generating…" : "Generate key"}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirm("rotate")}>
                  Rotate
                </Button>
                <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirm("revoke")}>
                  Revoke
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "revoke" ? "Revoke the MCP key?" : "Rotate the MCP key?"}</DialogTitle>
            <DialogDescription>
              {confirm === "revoke"
                ? "Grok Bot will not be able to connect until you generate a new key."
                : "A new key is created and the current key stops working immediately."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={confirm === "revoke" ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                run(() => (confirm === "revoke" ? revokeMcpAccessKeyAction() : rotateMcpAccessKeyAction()))
              }
            >
              {confirm === "revoke" ? "Revoke key" : "Rotate key"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              Keep current key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
