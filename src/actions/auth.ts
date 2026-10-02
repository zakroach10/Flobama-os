"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema, passwordResetRequestSchema } from "@/lib/validation/schemas";
import { safeInternalPath } from "@/lib/auth/redirects";
import { firstMenuHref, hasMenu, menuForPath } from "@/lib/auth/menus";
import { getStaffContext } from "@/lib/auth/staff";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";

export type AuthActionResult = {
  ok: boolean;
  message: string;
};

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and password." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, message: error.message };

  const requested = safeInternalPath(parsed.data.next, "/dashboard");
  const context = await getStaffContext();
  if (context.status === "ok") {
    const home = firstMenuHref(context.menus) ?? "/no-menus";
    const menu = menuForPath(requested);
    if (menu && hasMenu(context.menus, menu)) {
      redirect(requested);
    }
    redirect(home);
  }

  redirect(requested);
}

export async function requestPasswordResetAction(formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: "If that account exists, a reset email is on the way. Check your inbox.",
  };
}
