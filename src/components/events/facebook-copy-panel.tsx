"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildFacebookCopy, type FacebookCopyField, type FacebookCopyInput } from "@/lib/events/facebook-copy";

export function FacebookCopyPanel({ source }: { source: FacebookCopyInput }) {
  const pack = buildFacebookCopy(source);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Facebook</h2>
        <p className="text-sm text-muted-foreground">
          Ready-to-paste copy for a Facebook post or a Facebook Event. Times use {pack.timeZone}. Built from the
          public title, description, schedule, location, hosts, tickets, and price. Internal notes are not included.
        </p>
      </div>
      <Tabs defaultValue="post">
        <TabsList className="h-auto min-h-11">
          <TabsTrigger value="post" className="min-h-11 px-3">
            Facebook post
          </TabsTrigger>
          <TabsTrigger value="event" className="min-h-11 px-3">
            Facebook Event
          </TabsTrigger>
        </TabsList>
        <TabsContent value="post" className="space-y-3 pt-3">
          <CopyAllButton
            copied={copied === "post:all"}
            disabled={!pack.post}
            onCopy={() => void copy("post:all", pack.post)}
          />
          <FieldList fields={pack.postFields} prefix="post" copied={copied} onCopy={copy} />
        </TabsContent>
        <TabsContent value="event" className="space-y-3 pt-3">
          <CopyAllButton
            copied={copied === "event:all"}
            disabled={!pack.eventSetup}
            onCopy={() => void copy("event:all", pack.eventSetup)}
          />
          <FieldList fields={pack.eventFields} prefix="event" copied={copied} onCopy={copy} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CopyAllButton({
  copied,
  disabled,
  onCopy,
}: {
  copied: boolean;
  disabled: boolean;
  onCopy: () => void;
}) {
  return (
    <Button type="button" disabled={disabled} onClick={onCopy}>
      {copied ? "Copied" : "Copy all"}
    </Button>
  );
}

function FieldList({
  fields,
  prefix,
  copied,
  onCopy,
}: {
  fields: FacebookCopyField[];
  prefix: string;
  copied: string | null;
  onCopy: (id: string, value: string) => void;
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">Add public event details to generate copy.</p>;
  }

  return (
    <ul className="space-y-3">
      {fields.map((item) => {
        const id = `${prefix}:${item.key}`;
        return (
          <li key={id} className="space-y-2 rounded-lg border bg-background p-3">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.value}</p>
            <Button type="button" variant="outline" onClick={() => void onCopy(id, item.value)}>
              {copied === id ? "Copied" : `Copy ${item.label}`}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
