import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { StaffRole } from "@/lib/constants";

export type StaffMember = {
  userId: string;
  role: StaffRole;
  displayName: string;
  email: string | null;
  createdAt: string;
};

type Client = SupabaseClient<Database>;

export async function listVenueStaff(client: Client, venueId: string) {
  const { data, error } = await client.rpc("list_venue_staff", { p_venue_id: venueId });
  if (error) return { members: [] as StaffMember[], error: error.message };
  const members = (data ?? []).map((row) => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name || row.email || "Staff",
    email: row.email,
    createdAt: row.created_at,
  }));
  return { members, error: null };
}
