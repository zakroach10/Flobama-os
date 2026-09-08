"use server";

import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchActiveArtists } from "@/lib/queries/artists";
import { artistNameMatches } from "@/lib/queries/artists";

export async function searchArtistsAction(query: string) {
  const context = await getStaffContext();
  if (context.status !== "ok") return { artists: [] as { id: string; name: string; genre: string | null }[], error: "Unauthorized" };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { artists: [], error: "Supabase is not configured." };
  return searchActiveArtists(supabase, context.venue.id, query);
}

export async function checkDuplicateArtistNameAction(name: string, excludeId?: string) {
  const context = await getStaffContext();
  if (context.status !== "ok") return { matches: [] as { id: string; name: string }[], error: "Unauthorized" };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { matches: [], error: "Supabase is not configured." };
  return artistNameMatches(supabase, context.venue.id, name, excludeId);
}
