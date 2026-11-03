#!/usr/bin/env node
/**
 * Mint, list, or revoke FloBama event-integration credentials.
 *
 * The plaintext token is printed once on create. It is stored only as a SHA-256
 * hash (UTF-8), matching src/lib/integrations/crypto.ts. Never pass the token
 * as a shell argument that lands in process lists or CI logs if you can avoid it;
 * this script generates the token itself and prints it on stdout.
 *
 * Required environment (server only, never the AI Studio browser):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 *   node scripts/integration-credential.mjs create --name "HighLevel AI Studio"
 *   node scripts/integration-credential.mjs list
 *   node scripts/integration-credential.mjs revoke --id <credential-uuid>
 */
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const FLO_BAMA_VENUE_ID = "11111111-1111-4111-8111-111111111111";
const SCOPES = ["events:read", "events:write", "artists:read", "artwork:write"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment. Values are not printed.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [command, ...rest] = process.argv.slice(2);
const args = new Map();
for (let i = 0; i < rest.length; i += 1) {
  const token = rest[i];
  if (!token.startsWith("--")) continue;
  args.set(token.slice(2), rest[i + 1]);
  i += 1;
}

if (command === "create") {
  const name = args.get("name")?.trim();
  if (!name || name.length > 120) {
    console.error('Usage: node scripts/integration-credential.mjs create --name "HighLevel AI Studio"');
    process.exit(1);
  }
  const venueId = args.get("venue")?.trim() || FLO_BAMA_VENUE_ID;
  const requestedScopes = (args.get("scopes") ?? SCOPES.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (requestedScopes.some((scope) => !SCOPES.includes(scope))) {
    console.error(`Scopes must be chosen from: ${SCOPES.join(", ")}`);
    process.exit(1);
  }
  const token = `fbint_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data, error } = await supabase
    .from("integration_credentials")
    .insert({
      venue_id: venueId,
      name,
      token_hash: tokenHash,
      token_prefix: token.slice(0, 12),
      scopes: requestedScopes,
    })
    .select("id, name, token_prefix, scopes, venue_id, created_at")
    .single();
  if (error || !data) {
    console.error(error?.message ?? "Could not create the integration credential.");
    process.exit(1);
  }
  console.log("Integration credential created. This token is shown once.");
  console.log(`id: ${data.id}`);
  console.log(`name: ${data.name}`);
  console.log(`prefix: ${data.token_prefix}`);
  console.log(`venue_id: ${data.venue_id}`);
  console.log(`scopes: ${data.scopes.join(", ")}`);
  console.log("");
  console.log("Set this on the AI Studio server only:");
  console.log(`FLOBAMA_OS_INTEGRATION_TOKEN=${token}`);
  process.exit(0);
}

if (command === "list") {
  const { data, error } = await supabase
    .from("integration_credentials")
    .select("id, name, token_prefix, scopes, venue_id, revoked_at, last_used_at, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(JSON.stringify(data ?? [], null, 2));
  process.exit(0);
}

if (command === "revoke") {
  const id = args.get("id")?.trim();
  if (!id) {
    console.error("Usage: node scripts/integration-credential.mjs revoke --id <credential-uuid>");
    process.exit(1);
  }
  const { data, error } = await supabase
    .from("integration_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id, token_prefix, revoked_at")
    .maybeSingle();
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!data) {
    console.error("No active credential matched that id.");
    process.exit(1);
  }
  console.log(`Revoked ${data.id} (${data.token_prefix}).`);
  process.exit(0);
}

console.error("Commands: create, list, revoke");
process.exit(1);
