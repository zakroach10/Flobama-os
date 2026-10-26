"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importEventsCsvAction } from "@/actions/events-csv";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVENTS_CSV_SAMPLE, EVENTS_CSV_SAMPLE_FILENAME } from "@/lib/events/csv";

export function ImportEventsCsvButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);

  function downloadSample() {
    const blob = new Blob([EVENTS_CSV_SAMPLE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = EVENTS_CSV_SAMPLE_FILENAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onFileChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsvText(text);
      setErrors([]);
    };
    reader.readAsText(file);
  }

  function onImport() {
    setErrors([]);
    startTransition(async () => {
      const result = await importEventsCsvAction({ csvText });
      if (!result.ok) {
        toast.error(result.message);
        setErrors(result.errors.length > 0 ? result.errors : [result.message]);
        return;
      }
      toast.success(result.message);
      setCsvText("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Upload CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload events CSV</DialogTitle>
            <DialogDescription>
              Create multiple events at once. Times use the venue timezone. Missing end times default to +3 hours
              (or 1:00 AM next day after 9:00 PM). New artist names are created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadSample}>
                Download sample CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => setCsvText(EVENTS_CSV_SAMPLE)}>
                Load sample
              </Button>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                Choose file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Headers:{" "}
              <code className="text-[11px]">
                title,event_type,start_date,start_time,end_date,end_time,location,status,visibility,artists
              </code>
              . Separate artists with <code className="text-[11px]">;</code> or <code className="text-[11px]">|</code>.
              Defaults: status draft, visibility public.
            </p>

            <textarea
              className="min-h-44 w-full rounded-md border bg-background p-3 font-mono text-xs"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setErrors([]);
              }}
              placeholder={EVENTS_CSV_SAMPLE}
              aria-label="Events CSV"
            />

            {errors.length > 0 ? (
              <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || !csvText.trim()} onClick={onImport}>
                {pending ? "Importing…" : "Import events"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
