import type { Metadata, Viewport } from "next";
import { isWallOpsShell } from "@/lib/auth/menus";
import { requireStaffMenu } from "@/lib/auth/require-menu";
import { getStaffContext } from "@/lib/auth/staff";
import { wallOpsPwaMetadata, WALL_OPS_PWA_THEME_COLOR } from "@/lib/pwa/wall-ops";

export const dynamic = "force-dynamic";

/** Keep the FloBama Screens manifest on /screens so the installed PWA can update while running. */
export async function generateMetadata(): Promise<Metadata> {
  const context = await getStaffContext();
  if (context.status === "ok" && isWallOpsShell(context.menus)) {
    return {
      ...wallOpsPwaMetadata,
      title: "Wall & Screens",
    };
  }
  return {
    title: "Screens",
    // Still expose the dedicated Screens PWA manifest so operators can install from /screens
    // without pulling in the public marketing site or the full staff OS shell.
    manifest: wallOpsPwaMetadata.manifest,
    applicationName: wallOpsPwaMetadata.applicationName,
    icons: wallOpsPwaMetadata.icons,
  };
}

export async function generateViewport(): Promise<Viewport> {
  const context = await getStaffContext();
  if (context.status === "ok" && isWallOpsShell(context.menus)) {
    return {
      themeColor: WALL_OPS_PWA_THEME_COLOR,
      colorScheme: "dark",
    };
  }
  return {};
}

export default async function ScreensLayout({ children }: { children: React.ReactNode }) {
  await requireStaffMenu("screens");
  return children;
}
