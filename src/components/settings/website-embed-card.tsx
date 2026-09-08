"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildPublicSurfaceUrls } from "@/lib/public/urls";

export function WebsiteEmbedCard({ siteUrl }: { siteUrl: string }) {
  const surfaces = buildPublicSurfaceUrls(siteUrl);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    toast.success(`Copied ${label}`);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Website & embed</h2>
      <p className="text-sm text-muted-foreground">
        Public origin: <span className="font-medium text-foreground">{surfaces.origin}</span>. Use these URLs on
        flobamadowntown.com (WordPress / Elementor) or anywhere else. This app does not edit that site. The Google
        Sheet feed is a legacy path.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium">Embed snippet</p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
          {surfaces.embedSnippet}
        </pre>
        <Button type="button" variant="outline" onClick={() => void copy("embed snippet", surfaces.embedSnippet)}>
          {copied === "embed snippet" ? "Copied" : "Copy embed"}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CopyRow
          label="Overlay (OBS Browser Source)"
          value={surfaces.overlay}
          copied={copied}
          onCopy={copy}
        />
        <CopyRow label="Events API" value={surfaces.eventsApi} copied={copied} onCopy={copy} />
        <CopyRow label="Now API" value={surfaces.nowApi} copied={copied} onCopy={copy} />
        <CopyRow label="Embed page" value={surfaces.embed} copied={copied} onCopy={copy} />
      </div>
      <p className="text-xs text-muted-foreground">
        Also <code>/api/public/v1/events/[id]</code>. GET only, CORS open, no internal notes. In Supabase Auth, add{" "}
        {surfaces.origin} as a Site URL / redirect origin.
      </p>
    </section>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs break-all text-muted-foreground">{value}</p>
      <Button type="button" variant="outline" onClick={() => void onCopy(label, value)}>
        {copied === label ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
