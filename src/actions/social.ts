"use server";

import { revalidatePath } from "next/cache";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import {
  createSocialPost,
  deleteSocialPost,
  updateSocialPost,
  weekSocialMediaItems,
  type CreateSocialPostInput,
} from "@/lib/ghl/social";
import { DEFAULT_WEEK_SOCIAL_FORMAT, isWeekSocialFormatId, type WeekSocialFormatId } from "@/lib/screens/social";
import type { ActionResult } from "@/actions/records";
import { GhlError } from "@/lib/ghl/client";

async function staffForSocial() {
  const context = await getStaffContext();
  if (context.status !== "ok") {
    return { ok: false as const, message: "Sign in required." };
  }
  const allowed = authorizeProgramming(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  return { ok: true as const };
}

function ghlMessage(error: unknown, fallback: string) {
  if (error instanceof GhlError || error instanceof Error) return error.message;
  return fallback;
}

export async function createWeekSocialPostAction(input: {
  accountIds: string[];
  summary: string;
  status: "draft" | "scheduled" | "published";
  scheduleDate?: string | null;
  formatId?: string;
  pageCount?: number;
}): Promise<ActionResult & { id?: string }> {
  const access = await staffForSocial();
  if (!access.ok) return access;

  const formatId: WeekSocialFormatId = isWeekSocialFormatId(input.formatId) ? input.formatId : DEFAULT_WEEK_SOCIAL_FORMAT;
  const summary = input.summary.trim() || "Live music this week at FloBama.";
  const accountIds = Array.isArray(input.accountIds) ? input.accountIds.filter(Boolean) : [];
  const status =
    input.status === "published" ? "published" : input.status === "scheduled" ? "scheduled" : "draft";

  if (status === "scheduled") {
    if (!input.scheduleDate?.trim()) {
      return { ok: false, message: "Pick a schedule date and time." };
    }
  }
  if (status !== "draft" && accountIds.length === 0) {
    return { ok: false, message: "Select at least one social account." };
  }

  const payload: CreateSocialPostInput = {
    accountIds,
    summary,
    status,
    scheduleDate: status === "scheduled" ? input.scheduleDate : null,
    media: weekSocialMediaItems({
      formatId,
      pageCount: Math.max(1, input.pageCount ?? 1),
      altText: summary,
    }),
    type: "post",
  };

  try {
    const post = await createSocialPost(payload);
    revalidatePath("/social");
    revalidatePath(`/social/posts/${post.id}`);
    const message =
      status === "published"
        ? "Posted in GoHighLevel."
        : status === "scheduled"
          ? "Post scheduled in GoHighLevel."
          : "Draft saved in GoHighLevel.";
    return { ok: true, message, id: post.id };
  } catch (error) {
    return { ok: false, message: ghlMessage(error, "Could not create social post.") };
  }
}

export async function updateSocialPostAction(
  postId: string,
  patch: { summary?: string; status?: "draft" | "scheduled" | "published"; scheduleDate?: string | null; accountIds?: string[] },
): Promise<ActionResult> {
  const access = await staffForSocial();
  if (!access.ok) return access;
  if (!postId.trim()) return { ok: false, message: "Missing post id." };

  try {
    await updateSocialPost(postId, patch);
    revalidatePath("/social");
    revalidatePath(`/social/posts/${postId}`);
    return { ok: true, message: "Post updated in GoHighLevel." };
  } catch (error) {
    return { ok: false, message: ghlMessage(error, "Could not update social post.") };
  }
}

export async function deleteSocialPostAction(postId: string): Promise<ActionResult> {
  const access = await staffForSocial();
  if (!access.ok) return access;
  if (!postId.trim()) return { ok: false, message: "Missing post id." };

  try {
    await deleteSocialPost(postId);
    revalidatePath("/social");
    return { ok: true, message: "Post deleted in GoHighLevel." };
  } catch (error) {
    return { ok: false, message: ghlMessage(error, "Could not delete social post.") };
  }
}
