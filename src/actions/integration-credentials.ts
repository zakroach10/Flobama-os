"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeStaffAdmin } from "@/lib/auth/permissions";
import {
  createIntegrationCredentialForVenue,
  listIntegrationCredentialsForVenue,
  revokeIntegrationCredentialForVenue,
  type StaffIntegrationCredential,
} from "@/lib/integrations/credentials-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createIntegrationCredentialSchema,
  revokeIntegrationCredentialSchema,
} from "@/lib/validation/schemas";

export type IntegrationCredentialActionResult = {
  ok: boolean;
  message: string;
  token?: string;
  credential?: StaffIntegrationCredential;
  credentials?: StaffIntegrationCredential[];
};

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

async function adminGate() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = authorizeStaffAdmin(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false as const,
      message: "Set SUPABASE_SERVICE_ROLE_KEY on the FloBama OS server before managing integration tokens.",
    };
  }
  return { ok: true as const, context, admin };
}

function revalidateSettings() {
  revalidatePath("/settings");
}

export async function listIntegrationCredentialsAction(): Promise<IntegrationCredentialActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const listed = await listIntegrationCredentialsForVenue(gate.admin, gate.context.venue.id);
  if (!listed.ok) return { ok: false, message: listed.message };
  return { ok: true, message: "ok", credentials: listed.credentials };
}

export async function createIntegrationCredentialAction(
  input: unknown,
): Promise<IntegrationCredentialActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = createIntegrationCredentialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const created = await createIntegrationCredentialForVenue(gate.admin, {
    venueId: gate.context.venue.id,
    name: parsed.data.name,
    scopes: parsed.data.scopes,
    createdBy: gate.context.userId,
  });
  if (!created.ok) return { ok: false, message: created.message };

  revalidateSettings();
  return {
    ok: true,
    message: "Integration token created. Copy it now — FloBama OS will not show it again.",
    token: created.token,
    credential: created.credential,
  };
}

export async function revokeIntegrationCredentialAction(
  input: unknown,
): Promise<IntegrationCredentialActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = revokeIntegrationCredentialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const revoked = await revokeIntegrationCredentialForVenue(gate.admin, {
    venueId: gate.context.venue.id,
    credentialId: parsed.data.credentialId,
  });
  if (!revoked.ok) return { ok: false, message: revoked.message };

  revalidateSettings();
  return {
    ok: true,
    message: revoked.alreadyRevoked
      ? "Credential was already revoked."
      : "Credential revoked. AI Studio can no longer use that token.",
  };
}
