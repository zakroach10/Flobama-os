"use client";

import { useState } from "react";
import { ReorderList } from "@/components/audience/reorder-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChoiceRow = { id: string; label: string };

function rowsFrom(value: string[]): ChoiceRow[] {
  const source = value.length > 0 ? value : [""];
  return source.map((label) => ({
    id: `choice-${Math.random().toString(36).slice(2, 10)}`,
    label,
  }));
}

export function ChoiceListEditor({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<ChoiceRow[]>(() => rowsFrom(value));

  function commit(next: ChoiceRow[]) {
    setRows(next);
    onChange(next.map((row) => row.label));
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">Drag a choice, or use Up and Down. This is the order on the wall.</p>
      <ReorderList
        items={rows}
        getId={(row) => row.id}
        getLabel={(row) => row.label.trim() || "choice"}
        listLabel={label}
        disabled={disabled}
        className="space-y-2"
        onReorder={commit}
        renderItem={(row) => (
          <div className="flex items-center gap-2">
            <Input
              value={row.label}
              aria-label={`${label} text`}
              disabled={disabled}
              onChange={(event) => {
                commit(rows.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)));
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11"
              disabled={disabled || rows.length <= 1}
              onClick={() => commit(rows.filter((item) => item.id !== row.id))}
            >
              Remove
            </Button>
          </div>
        )}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-11"
        disabled={disabled || rows.length >= 12}
        onClick={() => commit([...rows, { id: `choice-new-${rows.length}-${Date.now()}`, label: "" }])}
      >
        Add choice
      </Button>
    </div>
  );
}
