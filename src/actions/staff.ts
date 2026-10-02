"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import {
  authorizeMembershipChange,
  authorizeStaffAdmin,
  isMasterAdminEmail,
} from "@/lib/auth/permissions";
import {
  authorizeMenuSelection,
  menusForRole,
  staffMenusSqlMessage,
} from "@/lib/auth/menus";
import {
  isMissingWallOpsColumn,
  isWallOpsAccount,
  WALL_OPS_HOME_PATH,
  WALL_OPS_LOGIN_PATH,
  WALL_OPS_MENUS,
  WALL_OPS_SQL,
} from "@/lib/auth/wall-ops";
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

  const wallOpsUserId = gate.context.venue.wall_ops_user_id;
  const menus = menusForRole(parsed.data.role, parsed.data.menus);
  const menuDecision = authorizeMenuSelection(email, menus, { wallOpsUserId });
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

  const wallOpsUserId = gate.context.venue.wall_ops_user_id;
  const menus = isWallOpsAccount({
    userId: target.userId,
    email: target.email,
    wallOpsUserId,
  })
    ? ([...WALL_OPS_MENUS] as ReturnType<typeof menusForRole>)
    : menusForRole(parsed.data.role as StaffRole, parsed.data.menus);
  const menuDecision = authorizeMenuSelection(target.email, menus, {
    userId: target.userId,
    wallOpsUserId,
  });
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

  if (gate.context.venue.wall_ops_user_id === parsed.data.userId) {
    await gate.supabase
      .from("venues")
      .update({ wall_ops_user_id: null })
      .eq("id", gate.context.venue.id);
  }

  revalidateStaff();
  return { ok: true, message: "Access removed. Their login still exists; they can no longer open this venue." };
}

const computerControlSchema = z.object({
  email: z.email("Enter a valid email."),
  displayName: z.string().trim().min(1, "Display name is required.").max(120),
  password: z.string().min(8, "Use at least 8 characters."),
});

function wallOpsSqlMessage(message: string) {
  if (!isMissingWallOpsColumn(message)) return message;
  return `Apply ${WALL_OPS_SQL} on the hosted database before saving the computer control login.`;
}

export async function createComputerControlUserAction(input: unknown): Promise<StaffActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = computerControlSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      message:
        "Computer control setup needs SUPABASE_SERVICE_ROLE_KEY on the server. Add it to .env.local and never expose it to the browser.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  if (isMasterAdminEmail(email)) {
    return { ok: false, message: "The master admin cannot become the computer control login." };
  }

  const { members, error: listError } = await listVenueStaff(gate.supabase, gate.context.venue.id);
  if (listError) return { ok: false, message: listError };

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
      created.error?.message?.toLowerCase().includes("already") || created.error?.status === 422;
    if (!duplicate) {
      return { ok: false, message: created.error?.message ?? "Could not create the login." };
    }
    userId = await findAuthUserIdByEmail(email);
    existingUser = true;
    if (!userId) {
      return {
        ok: false,
        message: created.error?.message ?? "That email already exists, but the account could not be loaded.",
      };
    }
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    display_name: parsed.data.displayName,
  });
  if (profileError) return { ok: false, message: profileError.message };

  const alreadyMember = members.some((member) => member.userId === userId);
  const membershipPayload = {
    venue_id: gate.context.venue.id,
    user_id: userId,
    role: "manager" as const,
    menus: [...WALL_OPS_MENUS],
  };
  const { error: membershipError } = alreadyMember
    ? await gate.supabase
        .from("venue_memberships")
        .update({ role: "manager", menus: [...WALL_OPS_MENUS] })
        .eq("venue_id", gate.context.venue.id)
        .eq("user_id", userId)
    : await gate.supabase.from("venue_memberships").insert(membershipPayload);
  if (membershipError) return { ok: false, message: staffMenusSqlMessage(membershipError.message) };

  const { error: venueError } = await gate.supabase
    .from("venues")
    .update({ wall_ops_user_id: userId })
    .eq("id", gate.context.venue.id);
  if (venueError) return { ok: false, message: wallOpsSqlMessage(venueError.message) };

  revalidateStaff();
  revalidatePath(WALL_OPS_HOME_PATH);
  revalidatePath(WALL_OPS_LOGIN_PATH);
  return {
    ok: true,
    created: !existingUser,
    existingUser,
    message: existingUser
      ? `Computer control login ready. Open ${WALL_OPS_LOGIN_PATH} on the venue computer and sign in with this email.`
      : `Computer control login created. Open ${WALL_OPS_LOGIN_PATH} on the venue computer, sign in, then install it from Chrome as an app.`,
  };
}

export async function clearComputerControlUserAction(): Promise<StaffActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const { error } = await gate.supabase
    .from("venues")
    .update({ wall_ops_user_id: null })
    .eq("id", gate.context.venue.id);
  if (error) return { ok: false, message: wallOpsSqlMessage(error.message) };

  revalidateStaff();
  return {
    ok: true,
    message: "Computer control designation cleared. That login still exists under Staff if you need it.",
  };
}
