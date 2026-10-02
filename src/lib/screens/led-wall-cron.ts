import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getCronSecret } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  runLedWallAutomation,
  type LedWallAutomationResult,
} from "@/lib/screens/led-wall-automation";

const DISPLAY_TRIGGER_MIN_INTERVAL_MS = 45_000;

let lastDisplayTriggerAt = 0;
let displayTriggerInFlight: Promise<LedWallAutomationResult | null> | null = null;

export function isLedCronAuthorized(request: Request) {
  const secret = getCronSecret();
  const header = request.headers.get("authorization");
  if (secret) {
    return header === `Bearer ${secret}`;
  }
  // Without CRON_SECRET, still accept Vercel's cron marker so schedules don't die silently.
  return request.headers.get("x-vercel-cron") === "1";
}

/**
 * Best-effort automation from the LED display poll path.
 * Throttled so 1s client polls do not hammer Supabase.
 */
export function triggerLedWallAutomationFromDisplay() {
  const now = Date.now();
  if (displayTriggerInFlight) return displayTriggerInFlight;
  if (now - lastDisplayTriggerAt < DISPLAY_TRIGGER_MIN_INTERVAL_MS) {
    return Promise.resolve(null);
  }

  const admin = createServiceRoleClient();
  if (!admin) return Promise.resolve(null);

  lastDisplayTriggerAt = now;
  displayTriggerInFlight = runLedWallAutomation(admin, FLO_BAMA_VENUE_ID, new Date())
    .catch(() => null)
    .finally(() => {
      displayTriggerInFlight = null;
    });
  return displayTriggerInFlight;
}
