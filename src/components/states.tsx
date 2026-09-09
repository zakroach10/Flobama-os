import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Button className="mt-5" render={<Link href={actionHref} />}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-16">
      <FlobamaLogo className="mb-5 w-[220px]" />
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">FloBama OS</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Setup required</h1>
      <p className="mt-3 text-muted-foreground">
        This staff app needs a Supabase project before anyone can sign in or save data. Missing
        environment variables:
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 font-mono text-sm">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Copy <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> to{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>, fill in your project
        values, and restart the dev server. Authentication is not bypassed while configuration is
        missing.
      </p>
    </main>
  );
}
