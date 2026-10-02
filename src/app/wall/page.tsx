import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { getStaffContext } from "@/lib/auth/staff";
import { WALL_OPS_HOME_PATH } from "@/lib/auth/wall-ops";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { SetupRequired } from "@/components/states";

export const metadata: Metadata = {
  title: "Wall & Screens",
  description: "Sign in to run the FloBama LED wall and venue screens.",
  manifest: "/wall.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FloBama Wall",
    statusBarStyle: "default",
  },
};

export default async function WallLoginPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }

  const context = await getStaffContext();
  if (context.status === "ok") {
    redirect(WALL_OPS_HOME_PATH);
  }

  return (
    <AuthFrame
      title="Wall & Screens"
      subtitle="Sign in on this computer to control the LED wall and venue screens. Install this page from Chrome as an app for one-tap access."
      showBackToLogin={false}
    >
      <LoginForm nextPath={WALL_OPS_HOME_PATH} compact />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Chrome → Install page as app / Cast, save, and share → Install page as app
      </p>
    </AuthFrame>
  );
}
