import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { WallOpsInstallCard } from "@/components/pwa/wall-ops-install-card";
import { WallOpsPwaRegister } from "@/components/pwa/wall-ops-pwa-register";
import { safeInternalPath } from "@/lib/auth/redirects";
import { getStaffContext } from "@/lib/auth/staff";
import { WALL_OPS_HOME_PATH } from "@/lib/auth/wall-ops";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { wallOpsPwaMetadata, WALL_OPS_PWA_THEME_COLOR } from "@/lib/pwa/wall-ops";
import { SetupRequired } from "@/components/states";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...wallOpsPwaMetadata,
  title: "FloBama Screens",
  description: "Sign in to run the FloBama LED wall and venue screens.",
};

export const viewport: Viewport = {
  themeColor: WALL_OPS_PWA_THEME_COLOR,
  colorScheme: "dark",
};

export default async function WallLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }

  const params = await searchParams;
  const nextPath = safeInternalPath(params.next, WALL_OPS_HOME_PATH);

  const context = await getStaffContext();
  if (context.status === "ok") {
    redirect(nextPath);
  }

  const expired = params.reason === "expired" || params.reason === "revoked";

  return (
    <div className="dark min-h-full bg-background text-foreground">
      <WallOpsPwaRegister />
      <AuthFrame
        title="FloBama Screens"
        subtitle="Sign in once on this computer to control the LED wall and venue screens. Install as an app for one-tap access."
        showBackToLogin={false}
      >
        {expired ? (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Your session ended or was revoked. Sign in again to continue controlling the screens.
          </p>
        ) : null}
        <LoginForm nextPath={nextPath} compact />
        <div className="mt-6">
          <WallOpsInstallCard />
        </div>
      </AuthFrame>
    </div>
  );
}
