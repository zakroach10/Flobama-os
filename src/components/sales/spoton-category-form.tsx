"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertSpotOnCategoryMappingAction } from "@/actions/spoton";
import type { SpotOnReportingBucket } from "@/lib/spoton/types";

export function SpotOnCategoryMappingForm({
  existing,
}: {
  existing: Array<{ name: string; bucket: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [bucket, setBucket] = useState<SpotOnReportingBucket>("unmapped");

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Map SpotOn reporting categories</p>
      <ul className="text-sm text-muted-foreground">
        {existing.length === 0 ? (
          <li>No mappings yet</li>
        ) : (
          existing.map((row) => (
            <li key={row.name}>
              {row.name} → {row.bucket}
            </li>
          ))
        )}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await upsertSpotOnCategoryMappingAction({
              externalCategoryName: name,
              reportingBucket: bucket,
            });
            if (result.ok) {
              toast.success(result.message);
              setName("");
            } else toast.error(result.message);
          });
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="SpotOn category name"
          className="max-w-xs"
        />
        <select
          className="h-9 rounded-lg border bg-background px-3 text-sm"
          value={bucket}
          onChange={(e) => setBucket(e.target.value as SpotOnReportingBucket)}
        >
          <option value="food">Food</option>
          <option value="alcohol">Alcohol</option>
          <option value="other">Other</option>
          <option value="unmapped">Unmapped</option>
        </select>
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          Save mapping
        </Button>
      </form>
    </div>
  );
}
