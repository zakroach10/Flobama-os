import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { StaffRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

export type VenueRecord = Database["public"]["Tables"]["venues"]["Row"];
export type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"];

export type StaffContext =
  | { status: "unconfigured" }
  | { status: "unauthenticated" }
  | { status: "denied"; userId: string; email: string | undefined }
  | { status: "error"; message: string }
  | {
      status: "ok";
      userId: string;
      email: string | undefined;
      role: StaffRole;
      venue: VenueRecord;
      profile: ProfileRecord | null;
    };

export async function getStaffContext(): Promise<StaffContext> {
  if (!isSupabaseConfigured()) {
    return { status: "unconfigured" };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { status: "unconfigured" };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const missingSession =
    !user ||
    userError?.message === "Auth session missing!" ||
    userError?.name === "AuthSessionMissingError";

  if (missingSession) {
    return { status: "unauthenticated" };
  }
  if (userError) {
    return { status: "error", message: userError.message };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("venue_memberships")
    .select("role, venue_id, venues(*)")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) {
    return { status: "error", message: membershipError.message };
  }

  const membership = memberships?.[0];
  const venue = membership?.venues as VenueRecord | VenueRecord[] | null;
  const venueRow = Array.isArray(venue) ? venue[0] : venue;

  if (!membership || !venueRow) {
    return { status: "denied", userId: user.id, email: user.email };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    status: "ok",
    userId: user.id,
    email: user.email,
    role: membership.role,
    venue: venueRow,
    profile: profile ?? null,
  };
}

export async function requireStaff() {
  const context = await getStaffContext();
  return context;
}
