"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshWallDisplaysAction } from "@/actions/display-signals";
import { Button } from "@/components/ui/button";
import { SCREEN_DISPLAY_SIGNALS_SQL } from "@/lib/constants";

export function RefreshWallButton({
  missingTable = false,
  lastRequestedAt = null,
}: {
  missingTable?: boolean;
  lastRequestedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (missingTable) {
    return (
      <p className="text-xs text-muted-foreground">
        Wall refresh needs <code className="text-[11px]">{SCREEN_DISPLAY_SIGNALS_SQL}</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshWallDisplaysAction();
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              router.refresh();
            }
          })
        }
      >
        {pending ? "Refreshing…" : "Refresh wall screens"}
      </Button>
      {lastRequestedAt ? (
        <p className="text-xs text-muted-foreground">
          Last refresh {new Date(lastRequestedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
