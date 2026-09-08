"use server";

import { authorizeProgramming } from "@/lib/auth/permissions";
import { getStaffContext } from "@/lib/auth/staff";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type BoothActionResult = { ok: boolean; message: string };

async function staffForBooth() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

export async function setBoothLiveEventAction(eventId: string | null): Promise<BoothActionResult> {
  const gate = await staffForBooth();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  if (eventId) {
    const { data: event, error } = await gate.supabase
      .from("events")
      .select("id, venue_id")
      .eq("id", eventId)
      .eq("venue_id", gate.context.venue.id)
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!event) return { ok: false, message: "That event is not on this venue calendar." };
  }

  const { data: current, error: currentError } = await gate.supabase
    .from("booth_state")
    .select("lower_third_visible")
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (currentError) return { ok: false, message: currentError.message };

  const { error } = await gate.supabase.from("booth_state").upsert({
    venue_id: gate.context.venue.id,
    live_event_id: eventId,
    lower_third_visible: current?.lower_third_visible ?? true,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePublicSurfaces();
  return { ok: true, message: eventId ? "Now playing updated." : "Now playing cleared." };
}

export async function setBoothLowerThirdAction(visible: boolean): Promise<BoothActionResult> {
  const gate = await staffForBooth();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const { data: current, error: currentError } = await gate.supabase
    .from("booth_state")
    .select("live_event_id")
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (currentError) return { ok: false, message: currentError.message };

  const { error } = await gate.supabase.from("booth_state").upsert({
    venue_id: gate.context.venue.id,
    live_event_id: current?.live_event_id ?? null,
    lower_third_visible: visible,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePublicSurfaces();
  return { ok: true, message: visible ? "Lower third shown." : "Lower third hidden." };
}
