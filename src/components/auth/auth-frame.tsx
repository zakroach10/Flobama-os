import Link from "next/link";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

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
    <main className="relative flex min-h-full items-center justify-center px-4 py-8 sm:py-12">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <FlobamaLogo className="mb-4 w-[min(220px,72vw)]" />
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
