"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveEventAction, setEventStatusAction } from "@/actions/records";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EventStatus } from "@/lib/constants";
import Link from "next/link";

export function EventActions({
  eventId,
  status,
  archived,
  canEdit,
}: {
  eventId: string;
  status: EventStatus;
  archived: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"cancel" | "archive" | null>(null);

  function run(task: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setConfirm(null);
      router.refresh();
    });
  }

  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {!archived ? (
        <Button variant="outline" render={<Link href={`/events/${eventId}/edit`} />}>
          Edit
        </Button>
      ) : null}
      <Button variant="outline" render={<Link href={`/events/new?from=${eventId}`} />}>
        Duplicate
      </Button>
      {!archived && status !== "published" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setEventStatusAction(eventId, "published"))}
        >
          Publish
        </Button>
      ) : null}
      {!archived && status === "published" ? (
        <Button variant="outline" disabled={pending} onClick={() => run(() => setEventStatusAction(eventId, "draft"))}>
          Return to draft
        </Button>
      ) : null}
      {!archived && status !== "cancelled" ? (
        <Button variant="outline" disabled={pending} onClick={() => setConfirm("cancel")}>
          Cancel event
        </Button>
      ) : null}
      {!archived ? (
        <Button variant="destructive" disabled={pending} onClick={() => setConfirm("archive")}>
          Archive
        </Button>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "archive" ? "Archive this event?" : "Cancel this event?"}</DialogTitle>
            <DialogDescription>
              {confirm === "archive"
                ? "The event stays in history and can be found under Archived. It is not permanently deleted."
                : "The event remains in the database with cancelled status."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant={confirm === "archive" ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                run(() =>
                  confirm === "archive" ? archiveEventAction(eventId) : setEventStatusAction(eventId, "cancelled"),
                )
              }
            >
              Confirm
            </Button>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
