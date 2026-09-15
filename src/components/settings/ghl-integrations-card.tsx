import { getGhlConnectionStatus } from "@/lib/ghl/booking";
import { isOpenAiConfigured, DEFAULT_OPENAI_MODEL, getOpenAiConfig } from "@/lib/env";
import { Badge } from "@/components/ui/badge";

export async function GhlIntegrationsCard() {
  const status = await getGhlConnectionStatus();
  const openAi = getOpenAiConfig();
  const openAiConfigured = isOpenAiConfigured();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">GoHighLevel</h3>
          <Badge variant={status.configured ? "default" : "secondary"}>
            {status.configured ? "Connected" : "Not configured"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Private Integration Token lives in Vercel / <code>.env.local</code> only (
          <code>GHL_PRIVATE_TOKEN</code>, <code>GHL_LOCATION_ID</code>). It is never shown here, stored in Postgres, or
          sent to the browser. Booking uses custom objects <strong>Band Submission</strong> and{" "}
          <strong>Private events</strong> as the source of truth. Social uses Social Planner accounts and posts for the
          weekly event graphic desk.
        </p>
        {status.configured ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Location id</dt>
              <dd className="font-mono text-xs">{status.locationId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">API version</dt>
              <dd className="font-mono text-xs">{status.apiVersion}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Booking stays off until both environment variables are set, same as Stripe when{" "}
            <code>STRIPE_SECRET_KEY</code> is unset.
          </p>
        )}
        {status.error ? <p className="text-sm text-destructive">{status.error}</p> : null}
        <div>
          <p className="text-sm font-medium">Discovered objects</p>
          <ul className="mt-2 space-y-1 text-sm">
            {status.objects.map((object) => (
              <li key={object.kind}>
                {object.title}:{" "}
                {object.key ? (
                  <span className="font-mono text-xs">
                    {object.key}
                    {object.matchedBy === "override" ? " (env override)" : object.matchedBy === "key" ? " (known key)" : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">not found</span>
                )}
              </li>
            ))}
          </ul>
          {status.discoveredLabels.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Also in this location: {status.discoveredLabels.join(", ")}</p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium">Required PIT scopes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {status.requiredScopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Names vary slightly in the Private Integration UI — pick the Objects / Records read and write pair, plus
            Social Planner account/post scopes (<code>socialplanner/account.readonly</code>,{" "}
            <code>socialplanner/post.readonly</code>, <code>socialplanner/post.write</code>, optional{" "}
            <code>socialplanner/statistics.readonly</code>). Band submissions default to{" "}
            <code>custom_objects.band_inquiries</code>. Optional overrides: <code>GHL_OBJECT_BAND_SUBMISSION</code>,{" "}
            <code>GHL_OBJECT_PRIVATE_EVENTS</code>.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">OpenAI</h3>
          <Badge variant={openAiConfigured ? "default" : "secondary"}>
            {openAiConfigured ? "Connected" : "Not configured"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Band Submission booking-fit analysis uses <code>OPENAI_API_KEY</code> on the server only. The key is never
          shown here or sent to the browser. Analysis is advisory and does not change GoHighLevel status.
        </p>
        {openAi ? (
          <p className="text-sm text-muted-foreground">
            Model: <span className="font-mono text-xs">{openAi.model}</span>
          </p>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              This deployment does not see <code>OPENAI_API_KEY</code>. In Vercel → Project → Settings → Environment
              Variables, add exactly <code>OPENAI_API_KEY</code> (optional <code>OPENAI_MODEL</code>, default{" "}
              {DEFAULT_OPENAI_MODEL}).
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Enable the variable for the same environment you are viewing (Production and/or Preview).</li>
              <li>Redeploy after saving — new env vars are not applied to an already-running deployment.</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
