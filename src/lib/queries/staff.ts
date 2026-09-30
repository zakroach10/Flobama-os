import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { StaffRole } from "@/lib/constants";
import { isMissingMenusColumn, resolveMenus, type StaffMenuId } from "@/lib/auth/menus";

export type StaffMember = {
  userId: string;
  role: StaffRole;
  displayName: string;
  email: string | null;
  createdAt: string;
  menus: StaffMenuId[];
};

type Client = SupabaseClient<Database>;

export async function listVenueStaff(client: Client, venueId: string) {
  const { data, error } = await client.rpc("list_venue_staff", { p_venue_id: venueId });
  if (error) return { members: [] as StaffMember[], error: error.message, menusReady: true };

  const menuResult = await client.from("venue_memberships").select("user_id, menus").eq("venue_id", venueId);
  const menusReady = !menuResult.error || !isMissingMenusColumn(menuResult.error.message);
  if (menuResult.error && menusReady) {
    return { members: [] as StaffMember[], error: menuResult.error.message, menusReady: true };
  }

  const storedByUser = new Map(
    ((menuResult.data ?? []) as Array<{ user_id: string; menus: string[] | null }>).map((row) => [
      row.user_id,
      row.menus,
    ]),
  );
  const members = (data ?? []).map((row) => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name || row.email || "Staff",
    email: row.email,
    createdAt: row.created_at,
    menus: resolveMenus(menusReady ? storedByUser.get(row.user_id) : null, row.role),
  }));
  return { members, error: null, menusReady };
}
