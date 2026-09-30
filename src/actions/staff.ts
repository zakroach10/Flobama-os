"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeMembershipChange, authorizeStaffAdmin } from "@/lib/auth/permissions";
import { authorizeMenuSelection, normalizeMenuList, staffMenusSqlMessage } from "@/lib/auth/menus";
import { createStaffSchema, removeStaffSchema, updateStaffRoleSchema } from "@/lib/validation/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, findAuthUserIdByEmail } from "@/lib/supabase/admin";
import { listVenueStaff } from "@/lib/queries/staff";
import type { StaffRole } from "@/lib/constants";

export type StaffActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  created?: boolean;
  existingUser?: boolean;
};

function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

async function adminGate() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = authorizeStaffAdmin(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateStaff() {
  revalidatePath("/settings");
}

export async function createStaffAction(input: unknown): Promise<StaffActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      message: "Staff creation needs SUPABASE_SERVICE_ROLE_KEY on the server. Add it to .env.local and never expose it to the browser.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const { members, error: listError } = await listVenueStaff(gate.supabase, gate.context.venue.id);
  if (listError) return { ok: false, message: listError };
  if (members.some((member) => member.email?.toLowerCase() === email)) {
    return { ok: false, message: "That person already has access to this venue." };
  }

  const menus = normalizeMenuList(parsed.data.menus);
  const menuDecision = authorizeMenuSelection(email, menus);
  if (!menuDecision.allowed) return { ok: false, message: menuDecision.reason };

  let userId: string | null = null;
  let existingUser = false;
  const created = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.displayName },
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const duplicate =
      created.error?.message?.toLowerCase().includes("already") ||
      created.error?.status === 422;
    if (!duplicate) {
      return { ok: false, message: created.error?.message ?? "Could not create the login." };
    }
    userId = await findAuthUserIdByEmail(email);
    existingUser = true;
    if (!userId) {
      return { ok: false, message: created.error?.message ?? "That email already exists, but the account could not be loaded." };
    }
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    display_name: parsed.data.displayName,
  });
  if (profileError) return { ok: false, message: profileError.message };

  const { error: membershipError } = await gate.supabase.from("venue_memberships").insert({
    venue_id: gate.context.venue.id,
    user_id: userId,
    role: parsed.data.role,
    menus,
  });
  if (membershipError) return { ok: false, message: staffMenusSqlMessage(membershipError.message) };

  revalidateStaff();
  return {
    ok: true,
    created: !existingUser,
    existingUser,
    message: existingUser
      ? "Existing login attached. They can sign in with their current password."
      : "Staff account created. They can sign in with the email and password you set.",
  };
}

export async function updateStaffRoleAction(input: unknown): Promise<StaffActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = updateStaffRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { members, error } = await listVenueStaff(gate.supabase, gate.context.venue.id);
  if (error) return { ok: false, message: error };
  const target = members.find((member) => member.userId === parsed.data.userId);
  if (!target) return { ok: false, message: "That person is not on this venue." };

  const decision = authorizeMembershipChange({
    actorId: gate.context.userId,
    actorRole: gate.context.role,
    targetId: target.userId,
    targetRole: target.role,
    targetEmail: target.email,
    nextRole: parsed.data.role,
    adminCount: members.filter((member) => member.role === "admin").length,
  });
  if (!decision.allowed) return { ok: false, message: decision.reason };

  const menus = normalizeMenuList(parsed.data.menus);
  const menuDecision = authorizeMenuSelection(target.email, menus);
  if (!menuDecision.allowed) return { ok: false, message: menuDecision.reason };

  const { error: updateError } = await gate.supabase
    .from("venue_memberships")
    .update({ role: parsed.data.role as StaffRole, menus })
    .eq("venue_id", gate.context.venue.id)
    .eq("user_id", parsed.data.userId);
  if (updateError) return { ok: false, message: staffMenusSqlMessage(updateError.message) };

  revalidateStaff();
  return { ok: true, message: "Access updated." };
}

export async function removeStaffAction(input: unknown): Promise<StaffActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = removeStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Staff member is required." };

  const { members, error } = await listVenueStaff(gate.supabase, gate.context.venue.id);
  if (error) return { ok: false, message: error };
  const target = members.find((member) => member.userId === parsed.data.userId);
  if (!target) return { ok: false, message: "That person is not on this venue." };

  const decision = authorizeMembershipChange({
    actorId: gate.context.userId,
    actorRole: gate.context.role,
    targetId: target.userId,
    targetRole: target.role,
    targetEmail: target.email,
    removing: true,
    adminCount: members.filter((member) => member.role === "admin").length,
  });
  if (!decision.allowed) return { ok: false, message: decision.reason };

  const { error: deleteError } = await gate.supabase
    .from("venue_memberships")
    .delete()
    .eq("venue_id", gate.context.venue.id)
    .eq("user_id", parsed.data.userId);
  if (deleteError) return { ok: false, message: deleteError.message };

  revalidateStaff();
  return { ok: true, message: "Access removed. Their login still exists; they can no longer open this venue." };
}
