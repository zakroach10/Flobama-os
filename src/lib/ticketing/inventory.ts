import type { TableInventoryStatus } from "@/lib/ticketing/constants";

export function effectiveTableStatus(
  status: TableInventoryStatus,
  holdUntil: string | null | undefined,
  now = new Date(),
): TableInventoryStatus {
  if (status === "held" && holdUntil && Date.parse(holdUntil) <= now.getTime()) {
    return "available";
  }
  return status;
}

export function canCustomerSelect(status: TableInventoryStatus) {
  return status === "available";
}

export function tableIncludesCopy(capacity: number) {
  const seats = Math.max(1, capacity);
  return `Includes admission for up to ${seats} guest${seats === 1 ? "" : "s"}.`;
}
