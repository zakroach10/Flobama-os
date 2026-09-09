import Link from "next/link";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/actions/records";

export default function AccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
      <FlobamaLogo className="mb-5 w-[220px]" />
      <p className="text-sm font-semibold">FloBama OS</p>
      <h1 className="mt-2 text-3xl font-semibold">Access denied</h1>
      <p className="mt-3 text-muted-foreground">
        You are signed in, but this account is not a FloBama Music Hall staff member. Ask an
        administrator to create a venue membership. There is no self-serve signup.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
        <Button variant="ghost" render={<Link href="/login" />}>
          Sign in with a different account
        </Button>
      </div>
    </main>
  );
}
