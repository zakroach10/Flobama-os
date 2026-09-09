export function isMissingTicketingSchema(error: string | null | undefined) {
  if (!error) return false;
  return /event_ticketing|ticket_types|venue_layouts|event_layout|ticketing_orders|schema cache|does not exist/i.test(
    error,
  );
}

export const TICKETING_SETUP_HINT =
  "Apply supabase/migrations/20260909000008_ticketing.sql in the Supabase SQL editor, then reload.";
