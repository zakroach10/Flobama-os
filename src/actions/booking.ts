"use server";

import { revalidatePath } from "next/cache";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { updateBookingFields } from "@/lib/ghl/booking";
import { BOOKING_KINDS, type BookingKind } from "@/lib/ghl/objects";
import type { ActionResult } from "@/actions/records";

function isBookingKind(value: string): value is BookingKind {
  return (BOOKING_KINDS as readonly string[]).includes(value);
}

async function staffForBooking() {
  const context = await getStaffContext();
  if (context.status !== "ok") {
    return { ok: false as const, message: "Sign in required." };
  }
  const allowed = authorizeProgramming(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  return { ok: true as const };
}

export async function updateBookingRecordAction(
  kind: string,
  recordId: string,
  patch: { status?: string; notes?: string },
): Promise<ActionResult> {
  const access = await staffForBooking();
  if (!access.ok) return access;
  if (!isBookingKind(kind) || !recordId.trim()) {
    return { ok: false, message: "Invalid booking record." };
  }
  const result = await updateBookingFields(kind, recordId, patch);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/booking");
  revalidatePath(`/booking/${kind === "band_submission" ? "submissions" : "private-events"}`);
  revalidatePath(`/booking/${kind === "band_submission" ? "submissions" : "private-events"}/${recordId}`);
  return { ok: true, message: "Updated in GoHighLevel." };
}
