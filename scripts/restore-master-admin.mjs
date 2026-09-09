/**
 * Restore zak@view360.marketing as FloBama OS venue admin.
 * Usage: node --env-file=.env.local scripts/restore-master-admin.mjs
 */
import { createClient } from "@supabase/supabase-js";

const email = "zak@view360.marketing";
const venueId = "11111111-1111-4111-8111-111111111111";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId() {
  const lookup = new URL("/auth/v1/admin/users", url);
  lookup.searchParams.set("email", email);
  const response = await fetch(lookup, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (response.ok) {
    const payload = await response.json();
    if (payload.id) return payload.id;
    const match = (payload.users ?? []).find((user) => user.email?.toLowerCase() === email);
    if (match?.id) return match.id;
  }
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return listed.data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

const userId = await findUserId();
if (!userId) {
  console.error("Auth user not found. Create zak@view360.marketing in Authentication > Users, then re-run.");
  process.exit(2);
}

const profile = await admin.from("profiles").upsert({ id: userId, display_name: "Zakary" });
if (profile.error) {
  console.error("Profile upsert failed:", profile.error.message);
  process.exit(3);
}

const membership = await admin.from("venue_memberships").upsert({
  venue_id: venueId,
  user_id: userId,
  role: "admin",
});
if (membership.error) {
  console.error("Membership upsert failed:", membership.error.message);
  process.exit(4);
}

const verify = await admin
  .from("venue_memberships")
  .select("role")
  .eq("venue_id", venueId)
  .eq("user_id", userId)
  .maybeSingle();

console.log(`Restored master admin ${email} as ${verify.data?.role ?? "unknown"}.`);
