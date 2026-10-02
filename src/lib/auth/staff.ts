import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { StaffRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { isMissingMenusColumn, resolveMenus, type StaffMenuId } from "@/lib/auth/menus";
import { isMissingWallOpsColumn, isWallOpsAccount, WALL_OPS_MENUS } from "@/lib/auth/wall-ops";

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
      menus: StaffMenuId[];
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

  const fullMembership = await supabase
    .from("venue_memberships")
    .select("role, venue_id, menus, venues(*)")
    .eq("user_id", user.id)
    .limit(1);

  let memberships = fullMembership.data;
  let membershipError = fullMembership.error;
  if (membershipError && isMissingMenusColumn(membershipError.message)) {
    const basicMembership = await supabase
      .from("venue_memberships")
      .select("role, venue_id, venues(*)")
      .eq("user_id", user.id)
      .limit(1);
    membershipError = basicMembership.error;
    memberships = (basicMembership.data?.map((row) => ({ ...row, menus: null })) ?? null) as typeof memberships;
  }
  if (membershipError && isMissingWallOpsColumn(membershipError.message)) {
    const withoutWallOps = await supabase
      .from("venue_memberships")
      .select("role, venue_id, menus, venues(id, name, timezone, created_at, updated_at)")
      .eq("user_id", user.id)
      .limit(1);
    membershipError = withoutWallOps.error;
    memberships = withoutWallOps.data as typeof memberships;
  }

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

  const wallOpsUserId = (venueRow as { wall_ops_user_id?: string | null }).wall_ops_user_id ?? null;
  const menus: StaffMenuId[] = isWallOpsAccount({
    userId: user.id,
    email: user.email,
    wallOpsUserId,
  })
    ? [...WALL_OPS_MENUS]
    : resolveMenus((membership as { menus?: string[] | null }).menus ?? null, membership.role);

  return {
    status: "ok",
    userId: user.id,
    email: user.email,
    role: membership.role,
    menus,
    venue: { ...venueRow, wall_ops_user_id: wallOpsUserId },
    profile: profile ?? null,
  };
}

export async function requireStaff() {
  const context = await getStaffContext();
  return context;
}
