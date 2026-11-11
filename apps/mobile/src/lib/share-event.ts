import { Share } from "react-native";

import { SITE_EVENTS_URL, VENUE } from "@/src/config";
import { isVerifiedProductionTicketUrl } from "@/src/lib/tickets";
import type { PublicEventJson } from "@/src/types";

/**
 * Share public event details. Uses a verified external ticket URL when present;
 * otherwise shares the public events page (no invented per-event deep link).
 */
export async function sharePublicEvent(event: PublicEventJson): Promise<void> {
  const lines = [
    event.name,
    event.display ? `${event.display} (Central Time)` : null,
    event.locationLabel || VENUE.name,
    event.coverCharge ? `Cover: ${event.coverCharge}` : null,
  ].filter(Boolean);

  const url = isVerifiedProductionTicketUrl(event.ticketUrl)
    ? event.ticketUrl
    : SITE_EVENTS_URL;

  await Share.share({
    title: event.name,
    message: `${lines.join("\n")}\n\n${url}`,
    url,
  });
}
