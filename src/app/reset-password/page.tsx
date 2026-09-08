import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { SetupRequired } from "@/components/states";

export default function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }
  return (
    <AuthFrame
      title="Choose a new password"
      subtitle="Finish resetting your password after using the email link."
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
