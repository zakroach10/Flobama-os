import { describe, expect, it } from "vitest";
import { remainingCapacity, formatCents, applyFees, dollarsToCents } from "@/lib/ticketing/money";
import { effectiveTableStatus } from "@/lib/ticketing/inventory";
import { holdDemoTable, completeDemoCheckout, listDemoTables } from "@/lib/ticketing/memory-store";
import { newCheckoutSessionToken } from "@/lib/ticketing/tokens";

describe("ticketing money and inventory", () => {
  it("formats cents and applies venue fees", () => {
    expect(formatCents(15000)).toBe("$150.00");
    expect(dollarsToCents("20")).toBe(2000);
    expect(applyFees(10000, 250, 0)).toEqual({ fees: 250, tax: 0, total: 10250 });
  });

  it("keeps sellable inventory from going negative", () => {
    expect(remainingCapacity({ quantity: 250, blockedQuantity: 10, sold: 240, held: 5 })).toBe(0);
    expect(remainingCapacity({ quantity: 50, blockedQuantity: 0, sold: 12, held: 2 })).toBe(36);
  });

  it("releases expired table holds back to available", () => {
    expect(
      effectiveTableStatus("held", "2026-09-08T21:00:00.000Z", new Date("2026-09-08T22:00:00.000Z")),
    ).toBe("available");
    expect(
      effectiveTableStatus("held", "2026-09-08T22:10:00.000Z", new Date("2026-09-08T22:00:00.000Z")),
    ).toBe("held");
    expect(effectiveTableStatus("sold", "2026-09-08T21:00:00.000Z", new Date("2026-09-08T22:00:00.000Z"))).toBe(
      "sold",
    );
  });
});

describe("table hold race", () => {
  it("lets only the first session keep an available table", () => {
    const available = listDemoTables().find((table) => table.status === "available");
    expect(available).toBeTruthy();
    const first = newCheckoutSessionToken();
    const second = newCheckoutSessionToken();
    const held = holdDemoTable(available!.id, first);
    const conflict = holdDemoTable(available!.id, second);
    expect(held.ok).toBe(true);
    expect(conflict.ok).toBe(false);
    const paid = completeDemoCheckout({
      session: first,
      firstName: "Zak",
      lastName: "Roach",
      email: "zak@example.com",
      phone: null,
      tickets: [],
    });
    expect(paid.ok).toBe(true);
    if (paid.ok) {
      expect(paid.order.tableIds).toContain(available!.id);
      expect(paid.order.admissionsTotal).toBeGreaterThan(0);
    }
  });
});
