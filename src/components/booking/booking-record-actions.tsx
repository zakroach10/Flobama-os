"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateBookingRecordAction } from "@/actions/booking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BookingKind, BookingRecord } from "@/lib/ghl/objects";

export function BookingRecordActions({
  kind,
  record,
}: {
  kind: BookingKind;
  record: BookingRecord;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(record.status ?? "");
  const [notes, setNotes] = useState(record.notes ?? "");

  function saveStatus() {
    startTransition(async () => {
      const result = await updateBookingRecordAction(kind, record.id, { status });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function saveNotes() {
    startTransition(async () => {
      const result = await updateBookingRecordAction(kind, record.id, { notes });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  if (!record.statusFieldKey && !record.notesFieldKey) return null;

  return (
    <div className="space-y-6 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">Update in GoHighLevel</h2>
      {record.statusFieldKey ? (
        <div className="space-y-2">
          <Label htmlFor="booking-status">Status / stage</Label>
          {record.statusOptions.length > 0 ? (
            <select
              id="booking-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              {record.statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="booking-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            />
          )}
          <Button type="button" disabled={pending || status === (record.status ?? "")} onClick={saveStatus}>
            Save status
          </Button>
        </div>
      ) : null}
      {record.notesFieldKey ? (
        <div className="space-y-2">
          <Label htmlFor="booking-notes">Notes</Label>
          <Textarea id="booking-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
          <Button type="button" variant="outline" disabled={pending || notes === (record.notes ?? "")} onClick={saveNotes}>
            Save notes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
