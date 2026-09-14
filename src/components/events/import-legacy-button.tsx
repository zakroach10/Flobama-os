"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importLegacyEventsAction } from "@/actions/legacy-import";
import { Button } from "@/components/ui/button";

export function ImportLegacyButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await importLegacyEventsAction();
            if (!result.ok) {
              toast.error(result.message);
              setSummary(result.message);
              return;
            }
            toast.success(result.message);
            setSummary(
              `${result.imported} listings · ${result.created} new · ${result.updated} updated · ${result.withdrawn} withdrawn · ${result.artistsCreated} artists added`,
            );
            router.refresh();
          });
        }}
      >
        {pending ? "Updating…" : "Update"}
      </Button>
      {summary ? <p className="max-w-xs text-right text-xs text-muted-foreground">{summary}</p> : null}
    </div>
  );
}
