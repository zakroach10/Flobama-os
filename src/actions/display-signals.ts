"use server";

import { revalidatePath } from "next/cache";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeLedWallActivate } from "@/lib/auth/permissions";
import { SCREEN_DISPLAY_SIGNALS_SQL } from "@/lib/constants";
import { isMissingDisplaySignalRelation } from "@/lib/screens/display-signals";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DisplaySignalActionResult = { ok: boolean; message: string; reloadNonce?: number };

function sqlMessage(message: string) {
  if (isMissingDisplaySignalRelation(message)) {
    return `Apply ${SCREEN_DISPLAY_SIGNALS_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

export async function refreshWallDisplaysAction(): Promise<DisplaySignalActionResult> {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false, message: "Sign in required." };
  if (context.status === "denied") return { ok: false, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false, message: context.message };
  const allowed = authorizeLedWallActivate(context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };

  const { data: existing, error: readError } = await supabase
    .from("screen_display_signals")
    .select("reload_nonce")
    .eq("venue_id", context.venue.id)
    .maybeSingle();
  if (readError) return { ok: false, message: sqlMessage(readError.message) };

  const nextNonce = (existing?.reload_nonce ?? 0) + 1;
  const now = new Date().toISOString();
  const { error } = await supabase.from("screen_display_signals").upsert(
    {
      venue_id: context.venue.id,
      reload_nonce: nextNonce,
      reload_requested_at: now,
      reload_requested_by: context.userId,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlMessage(error.message) };

  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/display/vertical");
  revalidatePath("/api/public/v1/screens/led");
  revalidatePath("/api/public/v1/screens/vertical");

  return {
    ok: true,
    reloadNonce: nextNonce,
    message: "Wall displays will reload within a few seconds.",
  };
}
