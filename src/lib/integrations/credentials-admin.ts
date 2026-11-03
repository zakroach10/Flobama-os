import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { EVENT_INTEGRATION_SQL } from "@/lib/constants";
import {
  createIntegrationToken,
  hashIntegrationToken,
  integrationTokenPrefix,
} from "@/lib/integrations/crypto";
import type { IntegrationScope } from "@/lib/integrations/contract";
import { INTEGRATION_SCOPES } from "@/lib/integrations/contract";

type Admin = SupabaseClient<Database>;

export type StaffIntegrationCredential = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: IntegrationScope[];
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export const INTEGRATION_SCOPE_LABELS: Record<IntegrationScope, string> = {
  "events:read": "Read events",
  "events:write": "Create and update events",
  "artists:read": "Look up artists",
  "artwork:write": "Upload artist LED artwork",
};

export const DEFAULT_AI_STUDIO_SCOPES: IntegrationScope[] = [
  "events:read",
  "events:write",
  "artists:read",
];

export function isMissingIntegrationRelation(message: string) {
  return /integration_credentials|integration_|schema cache|does not exist/i.test(message);
}

export function integrationSqlHint(message: string) {
  if (isMissingIntegrationRelation(message)) {
    return `Apply ${EVENT_INTEGRATION_SQL} in the Supabase SQL editor, then try again.`;
  }
  return "Could not update integration credentials.";
}

function normalizeScopes(scopes: string[]): IntegrationScope[] | null {
  const unique = [...new Set(scopes)];
  if (unique.length === 0) return null;
  if (unique.some((scope) => !(INTEGRATION_SCOPES as readonly string[]).includes(scope))) return null;
  return unique as IntegrationScope[];
}

export async function listIntegrationCredentialsForVenue(
  admin: Admin,
  venueId: string,
): Promise<{ ok: true; credentials: StaffIntegrationCredential[] } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from("integration_credentials")
    .select("id, name, token_prefix, scopes, revoked_at, last_used_at, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: integrationSqlHint(error.message) };

  const credentials: StaffIntegrationCredential[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: normalizeScopes(row.scopes) ?? [],
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }));
  return { ok: true, credentials };
}

export async function createIntegrationCredentialForVenue(
  admin: Admin,
  input: {
    venueId: string;
    name: string;
    scopes: IntegrationScope[];
    createdBy: string | null;
  },
): Promise<
  | { ok: true; credential: StaffIntegrationCredential; token: string }
  | { ok: false; message: string }
> {
  const scopes = normalizeScopes(input.scopes);
  if (!scopes) return { ok: false, message: "Select at least one valid permission." };

  const token = createIntegrationToken();
  const { data, error } = await admin
    .from("integration_credentials")
    .insert({
      venue_id: input.venueId,
      name: input.name.trim(),
      token_hash: hashIntegrationToken(token),
      token_prefix: integrationTokenPrefix(token),
      scopes,
      created_by: input.createdBy,
    })
    .select("id, name, token_prefix, scopes, revoked_at, last_used_at, created_at")
    .single();
  if (error || !data) return { ok: false, message: integrationSqlHint(error?.message ?? "Insert failed.") };

  void admin.from("integration_audit_log").insert({
    venue_id: input.venueId,
    credential_id: data.id,
    action: "credentials.create",
    event_id: null,
    request_id: `staff_${data.id.slice(0, 8)}`,
    reported_actor: null,
    metadata: { name: data.name, scopes: scopes.join(",") },
  });

  return {
    ok: true,
    token,
    credential: {
      id: data.id,
      name: data.name,
      tokenPrefix: data.token_prefix,
      scopes,
      revokedAt: data.revoked_at,
      lastUsedAt: data.last_used_at,
      createdAt: data.created_at,
    },
  };
}

export async function revokeIntegrationCredentialForVenue(
  admin: Admin,
  input: { venueId: string; credentialId: string },
): Promise<{ ok: true; alreadyRevoked: boolean } | { ok: false; message: string }> {
  const { data: existing, error: findError } = await admin
    .from("integration_credentials")
    .select("id, revoked_at")
    .eq("id", input.credentialId)
    .eq("venue_id", input.venueId)
    .maybeSingle();
  if (findError) return { ok: false, message: integrationSqlHint(findError.message) };
  if (!existing) return { ok: false, message: "Credential was not found." };
  if (existing.revoked_at) return { ok: true, alreadyRevoked: true };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("integration_credentials")
    .update({ revoked_at: now })
    .eq("id", existing.id)
    .eq("venue_id", input.venueId)
    .is("revoked_at", null);
  if (error) return { ok: false, message: integrationSqlHint(error.message) };

  void admin.from("integration_audit_log").insert({
    venue_id: input.venueId,
    credential_id: existing.id,
    action: "credentials.revoke",
    event_id: null,
    request_id: `staff_revoke_${existing.id.slice(0, 8)}`,
    reported_actor: null,
    metadata: {},
  });

  return { ok: true, alreadyRevoked: false };
}
