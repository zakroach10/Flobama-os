import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { firstMenuHref, hasMenu, type StaffMenuId } from "@/lib/auth/menus";
import { WALL_OPS_HOME_PATH, WALL_OPS_LOGIN_PATH } from "@/lib/auth/wall-ops";

export async function requireStaffMenu(menu: StaffMenuId) {
  const context = await getStaffContext();
  if (context.status !== "ok") {
    if (menu === "screens") {
      redirect(
        `${WALL_OPS_LOGIN_PATH}?next=${encodeURIComponent(WALL_OPS_HOME_PATH)}&reason=expired`,
      );
    }
    redirect("/login");
  }
  if (!hasMenu(context.menus, menu)) redirect(firstMenuHref(context.menus) ?? "/no-menus");
}
