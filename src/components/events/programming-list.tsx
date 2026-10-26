"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkUpdateEventsAction } from "@/actions/records";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, TypeBadge, VisibilityNote } from "@/components/status-badge";
import {
  BULK_EVENT_ACTIONS,
  type BulkEventAction,
  type EventStatus,
  type EventType,
  type EventVisibility,
} from "@/lib/constants";
import {
  bulkEventButtonLabel,
  bulkEventConfirmCopy,
  planBulkEventUpdate,
  type BulkEventSnapshot,
} from "@/lib/events/bulk";

export type ProgrammingListEvent = {
  id: string;
  title: string;
  whenLabel: string;
  artists: string[];
  eventType: EventType;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  archived: boolean;
};

const LIVE_ACTIONS: BulkEventAction[] = BULK_EVENT_ACTIONS.filter((action) => action !== "restore");
const ARCHIVED_ACTIONS: BulkEventAction[] = ["restore"];

export function ProgrammingEventList({
  events,
  canEdit,
  archivedView,
}: {
  events: ProgrammingListEvent[];
  canEdit: boolean;
  archivedView: boolean;
}) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectAllMobileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageKey, setPageKey] = useState(events.map((event) => event.id).join(","));
  const [pendingAction, setPendingAction] = useState<BulkEventAction | null>(null);
  const [pending, startTransition] = useTransition();

  const nextPageKey = events.map((event) => event.id).join(",");
  if (nextPageKey !== pageKey) {
    setPageKey(nextPageKey);
    setSelected(new Set());
  }

  const snapshots = new Map<string, BulkEventSnapshot>(
    events.map((event) => [
      event.id,
      {
        id: event.id,
        status: event.status,
        archivedAt: event.archived ? "archived" : null,
        visibility: event.visibility,
        featured: event.featured,
      },
    ]),
  );
  const selectedIds = [...selected];
  const actions = archivedView ? ARCHIVED_ACTIONS : LIVE_ACTIONS;
  const allSelected = events.length > 0 && events.every((event) => selected.has(event.id));
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    for (const node of [selectAllRef.current, selectAllMobileRef.current]) {
      if (node) node.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(events.map((event) => event.id)) : new Set());
  }

  function eligibleCount(action: BulkEventAction) {
    return planBulkEventUpdate(selectedIds, [...snapshots.values()], action).updateIds.length;
  }

  function run(action: BulkEventAction) {
    const ids = planBulkEventUpdate(selectedIds, [...snapshots.values()], action).updateIds;
    startTransition(async () => {
      const result = await bulkUpdateEventsAction({ action, eventIds: ids });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if ((result.updated ?? 0) === 0) toast.message(result.message);
      else toast.success(result.message);
      setPendingAction(null);
      setSelected(new Set());
      router.refresh();
    });
  }

  const confirm = pendingAction ? bulkEventConfirmCopy(pendingAction, eligibleCount(pendingAction)) : null;

  return (
    <div className={selected.size > 0 ? "space-y-3 pb-44" : "space-y-3"}>
      {canEdit ? (
        <p className="text-sm text-muted-foreground">
          {archivedView
            ? "Select archived events on this page to restore them to the calendar."
            : "Select events on this page to publish, return to draft, cancel, archive, or change visibility and featuring."}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              {canEdit ? (
                <th className="w-12 px-2 py-3 font-medium">
                  <label className="flex size-11 items-center justify-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allSelected}
                      aria-label="Select all events on this page"
                      onChange={(event) => toggleAll(event.target.checked)}
                    />
                  </label>
                </th>
              ) : null}
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Artists</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b last:border-0">
                {canEdit ? (
                  <td className="px-2 py-3">
                    <label className="flex size-11 items-center justify-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.has(event.id)}
                        aria-label={`Select ${event.title}`}
                        onChange={(change) => toggle(event.id, change.target.checked)}
                      />
                    </label>
                  </td>
                ) : null}
                <td className="px-4 py-3 whitespace-nowrap">{event.whenLabel}</td>
                <td className="px-4 py-3">
                  <Link className="font-medium underline-offset-4 hover:underline" href={`/programming/${event.id}`}>
                    {event.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{event.artists.join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <TypeBadge type={event.eventType} />
                </td>
                <td className="px-4 py-3">
                  <EventMarks event={event} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <label className="flex min-h-11 items-center gap-3 text-sm md:hidden">
          <input
            ref={selectAllMobileRef}
            type="checkbox"
            className="size-4 accent-primary"
            checked={allSelected}
            aria-label="Select all events on this page"
            onChange={(event) => toggleAll(event.target.checked)}
          />
          Select all on this page
        </label>
      ) : null}

      <ul className="space-y-3 md:hidden">
        {events.map((event) => (
          <li key={event.id} className="flex gap-1 rounded-xl border bg-card p-3">
            {canEdit ? (
              <label className="flex size-11 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.has(event.id)}
                  aria-label={`Select ${event.title}`}
                  onChange={(change) => toggle(event.id, change.target.checked)}
                />
              </label>
            ) : null}
            <Link href={`/programming/${event.id}`} className="block min-w-0 flex-1 space-y-2 py-1">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{event.title}</p>
                <EventMarks event={event} />
              </div>
              <p className="text-sm text-muted-foreground">{event.whenLabel}</p>
              <p className="text-sm">{event.artists.join(", ") || "No artists attached"}</p>
              <TypeBadge type={event.eventType} />
            </Link>
          </li>
        ))}
      </ul>

      {canEdit && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:px-5 md:left-56">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {selected.size} selected on this page
              </p>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => {
                const eligible = eligibleCount(action);
                return (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    className="min-h-11 sm:min-h-7"
                    variant={actionVariant(action)}
                    disabled={pending || eligible === 0}
                    data-bulk-action={action}
                    onClick={() => setPendingAction(action)}
                  >
                    {bulkEventButtonLabel(action, eligible, selected.size)}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {pendingAction && confirm ? (
        <Dialog open onOpenChange={(open) => !open && !pending && setPendingAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.description}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={actionVariant(pendingAction) === "destructive" ? "destructive" : "default"}
                disabled={pending}
                onClick={() => run(pendingAction)}
              >
                {pending ? "Working…" : "Confirm"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setPendingAction(null)}>
                Keep
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function EventMarks({ event }: { event: ProgrammingListEvent }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge status={event.status} />
      <VisibilityNote visibility={event.visibility} />
      {event.featured ? (
        <Badge variant="secondary" className="rounded-md">
          Featured
        </Badge>
      ) : null}
    </div>
  );
}

function actionVariant(action: BulkEventAction): "default" | "outline" | "destructive" {
  if (action === "publish" || action === "restore") return "default";
  if (action === "cancel" || action === "archive") return "destructive";
  return "outline";
}
