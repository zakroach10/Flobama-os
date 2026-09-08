"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WebsiteEmbedCard({ siteUrl }: { siteUrl: string }) {
  const origin = siteUrl.replace(/\/$/, "");
  const iframe = `<iframe src="${origin}/embed/events" title="FloBama events" style="width:100%;min-height:640px;border:0"></iframe>`;
  const snippet = `${iframe}\n<script src="${origin}/embed/events.js" defer></script>`;
  const api = `${origin}/api/public/v1/events`;
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
        FloBama OS is the source of truth. The Google Sheet feed on flobamadowntown.com is a legacy path. After
        deploy, paste the iframe into WordPress / Elementor or point the site at the JSON API. This app does not edit
        the production website.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium">Embed snippet</p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">{snippet}</pre>
        <Button type="button" variant="outline" onClick={() => void copy("embed snippet", snippet)}>
          {copied === "embed snippet" ? "Copied" : "Copy embed"}
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Public API</p>
        <p className="text-sm break-all">{api}</p>
        <p className="text-xs text-muted-foreground">
          Also <code>/api/public/v1/events/[id]</code> and <code>/api/public/v1/now</code>. GET only, CORS open, no
          internal notes.
        </p>
        <Button type="button" variant="outline" onClick={() => void copy("API URL", api)}>
          {copied === "API URL" ? "Copied" : "Copy API URL"}
        </Button>
      </div>
    </section>
  );
}
