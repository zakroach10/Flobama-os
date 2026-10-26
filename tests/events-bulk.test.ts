import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { bulkEventActionSchema } from "@/lib/validation/schemas";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) => createElement("a", { href }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock("@/actions/records", () => ({
  bulkUpdateEventsAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: () => undefined, success: () => undefined, message: () => undefined },
}));
import {
  bulkEventButtonLabel,
  bulkEventConfirmCopy,
  bulkEventUpdateFields,
  planBulkEventUpdate,
  summarizeBulkEventUpdate,
  type BulkEventSnapshot,
} from "@/lib/events/bulk";

const draft: BulkEventSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  archivedAt: null,
  visibility: "public",
  featured: false,
};

const published: BulkEventSnapshot = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "published",
  archivedAt: null,
  visibility: "private",
  featured: true,
};

const cancelled: BulkEventSnapshot = {
  id: "33333333-3333-4333-8333-333333333333",
  status: "cancelled",
  archivedAt: null,
  visibility: "public",
  featured: false,
};

const archived: BulkEventSnapshot = {
  id: "44444444-4444-4444-8444-444444444444",
  status: "draft",
  archivedAt: "2026-01-01T00:00:00.000Z",
  visibility: "public",
  featured: false,
};

const events = [draft, published, cancelled, archived];

describe("planBulkEventUpdate", () => {
  it("publishes drafts and cancelled events and skips published or archived rows", () => {
    const plan = planBulkEventUpdate(
      [draft.id, published.id, cancelled.id, archived.id, draft.id],
      events,
      "publish",
    );
    expect(plan.updateIds).toEqual([draft.id, cancelled.id]);
    expect(plan.skipped).toEqual([
      { id: published.id, reason: "already_applied" },
      { id: archived.id, reason: "archived" },
    ]);
  });

  it("returns only published events to draft", () => {
    const plan = planBulkEventUpdate([draft.id, published.id, cancelled.id], events, "draft");
    expect(plan.updateIds).toEqual([published.id]);
    expect(plan.skipped.map((row) => row.reason)).toEqual(["already_applied", "not_eligible"]);
  });

  it("cancels live events that are not already cancelled", () => {
    const plan = planBulkEventUpdate([draft.id, published.id, cancelled.id, archived.id], events, "cancel");
    expect(plan.updateIds).toEqual([draft.id, published.id]);
  });

  it("archives live events and restores only archived events", () => {
    expect(planBulkEventUpdate([draft.id, archived.id], events, "archive").updateIds).toEqual([draft.id]);
    expect(planBulkEventUpdate([draft.id, archived.id], events, "restore")).toEqual({
      updateIds: [archived.id],
      skipped: [{ id: draft.id, reason: "not_archived" }],
    });
  });

  it("updates visibility and featuring only when the flag would change", () => {
    expect(planBulkEventUpdate([draft.id, published.id, archived.id], events, "make_public").updateIds).toEqual([
      published.id,
    ]);
    expect(planBulkEventUpdate([draft.id, published.id], events, "make_private").updateIds).toEqual([draft.id]);
    expect(planBulkEventUpdate([draft.id, published.id], events, "feature").updateIds).toEqual([draft.id]);
    expect(planBulkEventUpdate([draft.id, published.id], events, "unfeature").updateIds).toEqual([published.id]);
  });

  it("reports ids outside the venue as not found", () => {
    const missing = "55555555-5555-4555-8555-555555555555";
    const plan = planBulkEventUpdate([missing], events, "publish");
    expect(plan.updateIds).toEqual([]);
    expect(plan.skipped).toEqual([{ id: missing, reason: "not_found" }]);
  });
});

describe("bulk event copy and patches", () => {
  it("maps each action onto the event columns", () => {
    const now = "2026-10-26T12:00:00.000Z";
    expect(bulkEventUpdateFields("publish", now)).toEqual({ status: "published" });
    expect(bulkEventUpdateFields("draft", now)).toEqual({ status: "draft" });
    expect(bulkEventUpdateFields("cancel", now)).toEqual({ status: "cancelled" });
    expect(bulkEventUpdateFields("archive", now)).toEqual({ archived_at: now });
    expect(bulkEventUpdateFields("restore", now)).toEqual({ archived_at: null });
    expect(bulkEventUpdateFields("make_public", now)).toEqual({ visibility: "public" });
    expect(bulkEventUpdateFields("make_private", now)).toEqual({ visibility: "private" });
    expect(bulkEventUpdateFields("feature", now)).toEqual({ featured: true });
    expect(bulkEventUpdateFields("unfeature", now)).toEqual({ featured: false });
  });

  it("describes how many rows changed", () => {
    expect(summarizeBulkEventUpdate("publish", 1, 0)).toBe("Published 1 event.");
    expect(summarizeBulkEventUpdate("draft", 2, 1)).toBe(
      "Returned 2 events to draft. Skipped 1 event already in that state or not eligible.",
    );
    expect(summarizeBulkEventUpdate("archive", 0, 3)).toBe(
      "No events were updated. 3 events were already in that state or not eligible.",
    );
  });

  it("names the eligible count when it is smaller than the selection", () => {
    expect(bulkEventButtonLabel("publish", 2, 5)).toBe("Publish (2)");
    expect(bulkEventButtonLabel("publish", 5, 5)).toBe("Publish");
    expect(bulkEventConfirmCopy("cancel", 2).title).toBe("Cancel 2 events?");
  });
});

describe("programming list", () => {
  it("shows selection and bulk actions for editors, including publish", async () => {
    const { ProgrammingEventList } = await import("@/components/events/programming-list");
    const html = renderToStaticMarkup(
      createElement(ProgrammingEventList, {
        canEdit: true,
        archivedView: false,
        events: [
          {
            id: draft.id,
            title: "Friday draft",
            whenLabel: "Fri, Oct 30, 8:00 PM",
            artists: ["The House Band"],
            eventType: "live_music",
            status: "draft",
            visibility: "private",
            featured: true,
            archived: false,
          },
        ],
      }),
    );

    expect(html).toContain('aria-label="Select all events on this page"');
    expect(html).toContain('aria-label="Select Friday draft"');
    expect(html).toContain('href="/programming/11111111-1111-4111-8111-111111111111"');
    expect(html).toContain("publish, return to draft, cancel, archive");
    expect(html).toContain("Private");
    expect(html).toContain("Featured");
    expect(html).not.toContain("restore them to the calendar");
  });

  it("hides bulk controls from read-only staff and offers restore for the archive", async () => {
    const { ProgrammingEventList } = await import("@/components/events/programming-list");
    const readOnly = renderToStaticMarkup(
      createElement(ProgrammingEventList, {
        canEdit: false,
        archivedView: false,
        events: [
          {
            id: published.id,
            title: "Saturday set",
            whenLabel: "Sat, Oct 31, 9:00 PM",
            artists: [],
            eventType: "dj",
            status: "published",
            visibility: "public",
            featured: false,
            archived: false,
          },
        ],
      }),
    );
    expect(readOnly).not.toContain("Select all events on this page");
    expect(readOnly).not.toContain("publish, return to draft, cancel, archive");
    expect(readOnly).toContain("No artists attached");

    const archivedHtml = renderToStaticMarkup(
      createElement(ProgrammingEventList, {
        canEdit: true,
        archivedView: true,
        events: [
          {
            id: archived.id,
            title: "Old show",
            whenLabel: "Mon, Jan 5, 7:00 PM",
            artists: ["Archive Act"],
            eventType: "other",
            status: "draft",
            visibility: "public",
            featured: false,
            archived: true,
          },
        ],
      }),
    );
    expect(archivedHtml).toContain("restore them to the calendar");
    expect(archivedHtml).not.toContain("publish, return to draft, cancel, archive");
  });
});

describe("bulkEventActionSchema", () => {
  it("requires a known action and at least one event id", () => {
    expect(bulkEventActionSchema.safeParse({ action: "publish", eventIds: [] }).success).toBe(false);
    expect(bulkEventActionSchema.safeParse({ action: "delete", eventIds: [draft.id] }).success).toBe(false);
    expect(bulkEventActionSchema.safeParse({ action: "publish", eventIds: [draft.id] }).success).toBe(true);
  });

  it("caps the selection", () => {
    const eventIds = Array.from({ length: 101 }, () => draft.id);
    expect(bulkEventActionSchema.safeParse({ action: "publish", eventIds }).success).toBe(false);
  });
});
