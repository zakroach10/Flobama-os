import Link from "next/link";
import { HelpShell } from "@/components/site/help/help-shell";

export default function HelpRun() {
  return (
    <HelpShell
      title="Run FloBama OS"
      description="Set up Supabase, bootstrap the first admin, and start the Next.js app on port 43123."
    >
      <div className="space-y-10 text-muted-foreground">
        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Prerequisites
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Node.js 20+ and npm</li>
            <li>A Supabase project (hosted) or Docker Desktop for a local stack</li>
            <li>
              Copy <code className="text-foreground">.env.example</code> to{" "}
              <code className="text-foreground">.env.local</code>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Option A — hosted Supabase (recommended)
          </h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Create a project at{" "}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                supabase.com/dashboard
              </a>
              . Do not use an existing production database.
            </li>
            <li>
              Fill <code className="text-foreground">.env.local</code> with{" "}
              <code className="text-foreground">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
              <code className="text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
              <code className="text-foreground">SUPABASE_SERVICE_ROLE_KEY</code>.
            </li>
            <li>
              Apply SQL migrations from <code className="text-foreground">supabase/migrations/</code>{" "}
              in filename order (SQL editor), or run{" "}
              <code className="text-foreground">npx supabase db push</code> after linking the
              project.
            </li>
            <li>
              In Authentication → URL Configuration, set Site URL and redirect URLs for{" "}
              <code className="text-foreground">http://localhost:43123</code> and your deploy
              origin (for example <code className="text-foreground">https://flobama-os.vercel.app</code>).
              Enable email/password; keep public registration off.
            </li>
            <li>Bootstrap the first admin (below), then start the app.</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Option B — local Docker Supabase
          </h2>
          <p className="mb-4">Requires Docker Desktop (or compatible) with enough RAM.</p>
          <pre className="overflow-x-auto rounded-md border border-border bg-card p-4 text-sm text-foreground">
{`npm install
npm run supabase:start
npm run supabase:env
npm run dev`}
          </pre>
          <p className="mt-4">
            Studio is at <code className="text-foreground">http://127.0.0.1:54323</code>. Create
            the first Auth user there, then run the admin SQL.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Start the app
          </h2>
          <pre className="overflow-x-auto rounded-md border border-border bg-card p-4 text-sm text-foreground">
{`npm install
npm run dev
# open http://localhost:43123`}
          </pre>
          <p className="mt-4">Useful scripts:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <code className="text-foreground">npm run build</code> /{" "}
              <code className="text-foreground">npm run start</code> — production build on port
              43123
            </li>
            <li>
              <code className="text-foreground">npm run lint</code>,{" "}
              <code className="text-foreground">npm run typecheck</code>,{" "}
              <code className="text-foreground">npm run test</code>
            </li>
            <li>
              <code className="text-foreground">npm run supabase:stop</code> — stop the local
              Docker stack
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Bootstrap the first admin
          </h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              In Supabase Authentication → Users, create a user with email and password. Copy
              the user UUID.
            </li>
            <li>
              Open <code className="text-foreground">supabase/bootstrap_admin.sql</code>, replace
              the placeholder UUID, and run it in the SQL editor.
            </li>
            <li>
              Sign in at <Link href="/" className="text-primary hover:underline">/</Link>. Later
              staff are created in Settings → Staff (requires{" "}
              <code className="text-foreground">SUPABASE_SERVICE_ROLE_KEY</code>).
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Deploy notes
          </h2>
          <p className="mb-4">
            Production example:{" "}
            <a
              href="https://flobama-os.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://flobama-os.vercel.app
            </a>
            . Set <code className="text-foreground">NEXT_PUBLIC_SITE_URL</code> to that origin
            (no trailing slash required) plus the Supabase keys. Redeploy after Auth redirect
            URLs include the deploy origin.
          </p>
          <p>
            For deeper product detail, see the{" "}
            <Link href="/help/introduction" className="text-primary hover:underline">
              Introduction
            </Link>{" "}
            and repository README.
          </p>
        </section>
      </div>
    </HelpShell>
  );
}
