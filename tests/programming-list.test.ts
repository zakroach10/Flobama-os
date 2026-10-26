/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) => createElement("a", { href }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock("@/actions/records", () => ({
  bulkUpdateEventsAction: vi.fn(async () => ({ ok: true, message: "Published 1 event.", updated: 1, skipped: 0 })),
}));

vi.mock("sonner", () => ({
  toast: { error: () => undefined, success: () => undefined, message: () => undefined },
}));

const draft = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Friday draft",
  whenLabel: "Fri, Oct 30, 8:00 PM",
  artists: ["The House Band"],
  eventType: "live_music" as const,
  status: "draft" as const,
  visibility: "public" as const,
  featured: false,
  archived: false,
};

const published = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Saturday set",
  whenLabel: "Sat, Oct 31, 9:00 PM",
  artists: ["DJ Night"],
  eventType: "dj" as const,
  status: "published" as const,
  visibility: "private" as const,
  featured: true,
  archived: false,
};

describe("programming bulk selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("enables publish for a selected draft and skips an already published row", async () => {
    const { ProgrammingEventList } = await import("@/components/events/programming-list");
    const { bulkUpdateEventsAction } = await import("@/actions/records");

    await act(async () => {
      root.render(createElement(ProgrammingEventList, { canEdit: true, archivedView: false, events: [draft, published] }));
    });

    const selectAll = document.querySelectorAll<HTMLInputElement>('input[aria-label="Select all events on this page"]');
    expect(selectAll.length).toBeGreaterThan(0);

    await act(async () => {
      selectAll[0].click();
    });

    const publish = document.querySelector<HTMLButtonElement>('[data-bulk-action="publish"]');
    const draftButton = document.querySelector<HTMLButtonElement>('[data-bulk-action="draft"]');
    expect(publish?.textContent).toBe("Publish (1)");
    expect(publish?.disabled).toBe(false);
    expect(draftButton?.textContent).toBe("Return to draft (1)");
    expect(document.body.textContent).toContain("2 selected on this page");

    await act(async () => {
      publish?.click();
    });

    expect(document.body.textContent).toContain("Publish 1 event?");

    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent === "Confirm");
    await act(async () => {
      confirm?.click();
    });

    expect(bulkUpdateEventsAction).toHaveBeenCalledWith({ action: "publish", eventIds: [draft.id] });
  });
});