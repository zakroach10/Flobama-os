import Link from "next/link";
import { FlobamaLogo } from "@/components/brand/flobama-logo";

export function AuthFrame({
  title,
  subtitle,
  children,
  showBackToLogin = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showBackToLogin?: boolean;
}) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <FlobamaLogo className="mb-4 w-[220px]" />
        <p className="text-sm font-semibold tracking-tight">FloBama OS</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">{subtitle}</p>
        {children}
        {showBackToLogin ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
