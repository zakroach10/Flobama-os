"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  bandPacketPath,
  formatPacketMonthLabel,
  listPacketMonths,
  type BandPacketScope,
} from "@/lib/booking/packet";

export type BandPacketListItem = {
  id: string;
  displayName: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export function BandPacketExportBar({
  items,
  selectedIds,
  onSelectedIdsChange,
}: {
  items: BandPacketListItem[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}) {
  const months = useMemo(() => listPacketMonths(items), [items]);
  const [scope, setScope] = useState<BandPacketScope>("selected");
  const [month, setMonth] = useState(months[0] ?? "");

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  function openPacket() {
    if (scope === "all") {
      window.open(bandPacketPath({ scope: "all" }), "_blank", "noopener,noreferrer");
      return;
    }
    if (scope === "month") {
      if (!month) return;
      window.open(bandPacketPath({ scope: "month", month }), "_blank", "noopener,noreferrer");
      return;
    }
    if (selectedIds.length === 0) return;
    window.open(bandPacketPath({ scope: "selected", ids: selectedIds }), "_blank", "noopener,noreferrer");
  }

  const canExport =
    scope === "all" || (scope === "month" && Boolean(month)) || (scope === "selected" && selectedIds.length > 0);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Export PDF packet</h3>
          <p className="text-xs text-muted-foreground">
            Build a one-page-per-band packet with full submission details and AI fit analysis for management.
          </p>
        </div>
        <Button type="button" className="w-full sm:w-auto" onClick={openPacket} disabled={!canExport}>
          Create packet
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="band-packet-scope"
            checked={scope === "selected"}
            onChange={() => setScope("selected")}
          />
          Selected ({selectedIds.length})
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="radio" name="band-packet-scope" checked={scope === "month"} onChange={() => setScope("month")} />
          By month
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="radio" name="band-packet-scope" checked={scope === "all"} onChange={() => setScope("all")} />
          All submissions
        </label>
        {scope === "month" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              aria-label="Packet month"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            {months.length > 0 ? (
              <select
                aria-label="Months on this page"
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={months.includes(month) ? month : ""}
                onChange={(event) => setMonth(event.target.value)}
              >
                <option value="" disabled>
                  From this page…
                </option>
                {months.map((value) => (
                  <option key={value} value={value}>
                    {formatPacketMonthLabel(value)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
        {scope === "selected" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectedIdsChange(allSelected ? [] : items.map((item) => item.id))}
            disabled={items.length === 0}
          >
            {allSelected ? "Clear page" : "Select page"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function BandPacketRowCheckbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={`Select ${label} for PDF packet`}
    />
  );
}
