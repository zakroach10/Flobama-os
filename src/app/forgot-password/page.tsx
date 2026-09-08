import { AuthFrame } from "@/components/auth/auth-frame";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { SetupRequired } from "@/components/states";

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }
  return (
    <AuthFrame
      title="Reset password"
      subtitle="We’ll email a link if the account exists. Completing the reset happens on the next screen."
    >
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
