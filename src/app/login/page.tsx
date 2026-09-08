import { LoginForm } from "@/components/auth/auth-forms";
import { AuthFrame } from "@/components/auth/auth-frame";
import { isSupabaseConfigured, missingPublicEnvNames } from "@/lib/env";
import { SetupRequired } from "@/components/states";
import { safeInternalPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired missing={missingPublicEnvNames()} />;
  }
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next, "/dashboard");

  return (
    <AuthFrame title="Sign in" subtitle="Staff access only. There is no public registration." showBackToLogin={false}>
      <LoginForm nextPath={nextPath} />
    </AuthFrame>
  );
}
