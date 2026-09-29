import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { firstMenuHref, hasMenu, type StaffMenuId } from "@/lib/auth/menus";

export async function requireStaffMenu(menu: StaffMenuId) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  if (!hasMenu(context.menus, menu)) redirect(firstMenuHref(context.menus) ?? "/no-menus");
}
