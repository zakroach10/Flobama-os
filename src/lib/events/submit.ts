import type { EventStatus } from "@/lib/constants";

export type EventSaveIntent = "save" | "publish";

/** Save keeps the selected status. Publish writes the same record as published. */
export function applyEventSaveIntent<T extends { status: EventStatus }>(values: T, intent: EventSaveIntent): T {
  if (intent === "publish") return { ...values, status: "published" };
  return values;
}

export function eventSaveMessage(isUpdate: boolean, intent: EventSaveIntent): string {
  if (intent === "publish") {
    return "Published. Public listings, embed, and API include this event when visibility is public.";
  }
  return isUpdate ? "Event saved." : "Event created.";
}
