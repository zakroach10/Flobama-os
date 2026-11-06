import { describe, expect, it } from "vitest";
import { authorizeStaffAdmin, canManageStaff, isReadOnly } from "@/lib/auth/permissions";
import { deriveCapabilityStatuses } from "@/lib/spoton/status";
import type { SpotOnSettingsRow } from "@/lib/spoton/types";
import { STAFF_MENUS } from "@/lib/auth/menus";

describe("SpotOn access controls", () => {
  it("restricts integration management to admins", () => {
    expect(authorizeStaffAdmin("admin").allowed).toBe(true);
    expect(authorizeStaffAdmin("manager").allowed).toBe(false);
    expect(authorizeStaffAdmin("viewer").allowed).toBe(false);
    expect(canManageStaff("admin")).toBe(true);
    expect(isReadOnly("viewer")).toBe(true);
  });

  it("routes Sales through the spoton staff menu (not external BOH only)", () => {
    const spoton = STAFF_MENUS.find((item) => item.id === "spoton");
    expect(spoton?.href).toBe("/sales");
    expect(spoton?.external).toBeFalsy();
  });

  it("does not treat credential presence alone as verified", () => {
    const previous = { ...process.env };
    process.env.SPOTON_LOCATION_ID = "BL-TEST";
    process.env.SPOTON_WEBHOOK_SIGNATURE_KEY = "abc";
    process.env.SPOTON_RESTAURANT_EXPORT_API_KEY = "key";
    const settings = {
      venue_id: "11111111-1111-4111-8111-111111111111",
      api_product: "restaurant_export",
      location_id: "BL-TEST",
      business_day_cutoff_local: "04:00:00",
      event_window_pre_minutes: 0,
      event_window_post_minutes: 0,
      webhook_status: "not_configured",
      reporting_status: "not_configured",
      menu_status: "not_configured",
      last_webhook_at: null,
      last_webhook_event_id: null,
      last_processed_event_id: null,
      last_processed_event_at: null,
      last_successful_sync_at: null,
      coverage_through: null,
      last_connection_test_at: null,
      last_connection_test_ok: null,
      last_connection_test_message: null,
      sync_enabled: false,
      publish_mapped_menu: false,
      notes: null,
    } satisfies SpotOnSettingsRow;

    const statuses = deriveCapabilityStatuses(settings);
    expect(statuses.webhook).toBe("configured_unverified");
    expect(statuses.reporting).toBe("configured_unverified");
    expect(statuses.webhook).not.toBe("verified");
    expect(statuses.reporting).not.toBe("verified");

    process.env = previous;
  });
});
