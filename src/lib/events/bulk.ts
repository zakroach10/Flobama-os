import {
  BULK_EVENT_ACTION_LABELS,
  type BulkEventAction,
  type EventStatus,
  type EventVisibility,
} from "@/lib/constants";
import type { Database } from "@/lib/database.types";

export type BulkEventSnapshot = {
  id: string;
  status: EventStatus;
  archivedAt: string | null;
  visibility: EventVisibility;
  featured: boolean;
};

export type BulkSkipReason = "not_found" | "archived" | "not_archived" | "already_applied" | "not_eligible";

export type BulkEventPlan = {
  updateIds: string[];
  skipped: Array<{ id: string; reason: BulkSkipReason }>;
};

type EventUpdate = Database["public"]["Tables"]["events"]["Update"];

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "event" : "events"}`;
}

function skipReason(event: BulkEventSnapshot, action: BulkEventAction): BulkSkipReason | null {
  const archived = event.archivedAt !== null;
  if (action === "restore") return archived ? null : "not_archived";
  if (archived) return "archived";

  switch (action) {
    case "publish":
      return event.status === "published" ? "already_applied" : null;
    case "draft":
      if (event.status === "draft") return "already_applied";
      if (event.status !== "published") return "not_eligible";
      return null;
    case "cancel":
      return event.status === "cancelled" ? "already_applied" : null;
    case "archive":
      return null;
    case "make_public":
      return event.visibility === "public" ? "already_applied" : null;
    case "make_private":
      return event.visibility === "private" ? "already_applied" : null;
    case "feature":
      return event.featured ? "already_applied" : null;
    case "unfeature":
      return event.featured ? null : "already_applied";
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function planBulkEventUpdate(
  requestedIds: string[],
  events: BulkEventSnapshot[],
  action: BulkEventAction,
): BulkEventPlan {
  const byId = new Map(events.map((event) => [event.id, event]));
  const updateIds: string[] = [];
  const skipped: BulkEventPlan["skipped"] = [];
  const seen = new Set<string>();

  for (const id of requestedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const event = byId.get(id);
    if (!event) {
      skipped.push({ id, reason: "not_found" });
      continue;
    }
    const reason = skipReason(event, action);
    if (reason) {
      skipped.push({ id, reason });
      continue;
    }
    updateIds.push(id);
  }

  return { updateIds, skipped };
}

export function bulkEventUpdateFields(action: BulkEventAction, nowIso: string): EventUpdate {
  switch (action) {
    case "publish":
      return { status: "published" };
    case "draft":
      return { status: "draft" };
    case "cancel":
      return { status: "cancelled" };
    case "archive":
      return { archived_at: nowIso };
    case "restore":
      return { archived_at: null };
    case "make_public":
      return { visibility: "public" };
    case "make_private":
      return { visibility: "private" };
    case "feature":
      return { featured: true };
    case "unfeature":
      return { featured: false };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function summarizeBulkEventUpdate(action: BulkEventAction, updated: number, skipped: number): string {
  if (updated === 0) {
    if (skipped === 0) return "No events were updated.";
    const verb = skipped === 1 ? "was" : "were";
    return `No events were updated. ${countLabel(skipped)} ${verb} already in that state or not eligible.`;
  }

  const lead = summaryLead(action, updated);
  if (skipped === 0) return lead;
  return `${lead} Skipped ${countLabel(skipped)} already in that state or not eligible.`;
}

function summaryLead(action: BulkEventAction, updated: number): string {
  const label = countLabel(updated);
  switch (action) {
    case "publish":
      return `Published ${label}.`;
    case "draft":
      return `Returned ${label} to draft.`;
    case "cancel":
      return `Cancelled ${label}.`;
    case "archive":
      return `Archived ${label}.`;
    case "restore":
      return `Restored ${label}.`;
    case "make_public":
      return `Made ${label} public.`;
    case "make_private":
      return `Made ${label} private.`;
    case "feature":
      return `Featured ${label}.`;
    case "unfeature":
      return `Removed the feature mark from ${label}.`;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function bulkEventConfirmCopy(action: BulkEventAction, count: number): { title: string; description: string } {
  const label = countLabel(count);
  switch (action) {
    case "publish":
      return {
        title: `Publish ${label}?`,
        description:
          "Published events appear on public listings, the embed, and the API when their visibility is public.",
      };
    case "draft":
      return {
        title: `Return ${label} to draft?`,
        description: "Drafts leave the public listings, embed, and API.",
      };
    case "cancel":
      return {
        title: `Cancel ${label}?`,
        description: "Cancelled events stay in the database and remain off the public listings.",
      };
    case "archive":
      return {
        title: `Archive ${label}?`,
        description: "Archived events stay in history under the Archived window. This does not delete them.",
      };
    case "restore":
      return {
        title: `Restore ${label}?`,
        description: "Restored events leave the archive and return to the calendar with their current status.",
      };
    case "make_public":
      return {
        title: `Make ${label} public?`,
        description: "Public events can appear on listings once they are published.",
      };
    case "make_private":
      return {
        title: `Make ${label} private?`,
        description: "Private events stay off public listings even when they are published.",
      };
    case "feature":
      return {
        title: `Feature ${label}?`,
        description: "Featured events are flagged on the public listings.",
      };
    case "unfeature":
      return {
        title: `Unfeature ${label}?`,
        description: "These events stay on the calendar without the featured flag.",
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function bulkEventButtonLabel(action: BulkEventAction, eligible: number, selected: number): string {
  const label = BULK_EVENT_ACTION_LABELS[action];
  if (eligible > 0 && eligible !== selected) return `${label} (${eligible})`;
  return label;
}
