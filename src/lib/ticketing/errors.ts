export function isMissingTicketingSchema(error: string | null | undefined) {
  if (!error) return false;
  return /event_ticketing|ticket_types|venue_layouts|event_layout|ticketing_orders|schema cache|does not exist/i.test(
    error,
  );
}

export const TICKETING_SETUP_HINT =
  "Apply supabase/migrations/20260909000008_ticketing.sql in the Supabase SQL editor, then reload.";

export const LAYOUT_TYPES_SETUP_HINT =
  "Apply supabase/migrations/20260909000010_layout_object_types.sql in the Supabase SQL editor, then retry.";

export function hintLayoutObjectTypeError(message: string) {
  if (/layout_object_type|invalid input value for enum/i.test(message) && /divider|restroom|layout_object_type/i.test(message)) {
    return `${message} ${LAYOUT_TYPES_SETUP_HINT}`;
  }
  return message;
}
