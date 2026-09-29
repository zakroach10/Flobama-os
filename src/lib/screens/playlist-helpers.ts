import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export async function ensureActivePlaylistId(client: Client, venueId: string) {
  const { data: existing, error } = await client
    .from("screen_playlists")
    .select("id")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();
  if (error) return { id: null as string | null, error: error.message };
  if (existing?.id) return { id: existing.id, error: null };

  const { data: created, error: createError } = await client
    .from("screen_playlists")
    .insert({ venue_id: venueId, name: "Main rotation", is_active: true })
    .select("id")
    .single();
  if (createError) return { id: null, error: createError.message };
  return { id: created.id, error: null };
}
