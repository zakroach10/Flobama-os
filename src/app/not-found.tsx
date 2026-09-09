import Link from "next/link";
import { FlobamaLogo } from "@/components/brand/flobama-logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
      <FlobamaLogo className="mb-5 w-[220px]" />
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted-foreground">That record or route is not in FloBama OS.</p>
      <Link href="/dashboard" className="mt-6 underline-offset-4 hover:underline">
        Back to dashboard
      </Link>
    </main>
  );
}
