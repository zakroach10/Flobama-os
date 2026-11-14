import { muxConfigured, muxEnvFromProcess, getLiveState } from "@/lib/customer/stream";
import { classifyStripeSecret, merchStripeSecret } from "@/lib/customer/stripe";

export const dynamic = "force-dynamic";

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={on ? "text-emerald-700" : "text-muted-foreground"}>{on ? "Set" : "Missing"}</span>
    </li>
  );
}

export default async function CustomerStreamPage() {
  const env = muxEnvFromProcess();
  const live = await getLiveState(env);
  const stripe = classifyStripeSecret(merchStripeSecret());
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{live.live ? "Live now" : "Offline"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{live.message}</p>
        {live.preview ? (
          <p className="mt-2 text-sm text-muted-foreground">
            This status is a preview because Mux credentials are not set. The app will not call this a real FloBama stream.
          </p>
        ) : null}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Environment</h2>
        <ul className="space-y-2">
          <Flag on={Boolean(env.tokenId)} label="MUX_TOKEN_ID" />
          <Flag on={Boolean(env.tokenSecret)} label="MUX_TOKEN_SECRET" />
          <Flag on={Boolean(env.liveStreamId)} label="MUX_LIVE_STREAM_ID" />
          <Flag on={Boolean(env.playbackId)} label="MUX_PLAYBACK_ID (optional)" />
          <Flag on={Boolean(env.webhookSecret)} label="MUX_WEBHOOK_SECRET" />
          <Flag on={stripe.kind === "test"} label="STRIPE_MERCH_SECRET_KEY (test)" />
          <Flag on={Boolean(process.env.STRIPE_MERCH_WEBHOOK_SECRET)} label="STRIPE_MERCH_WEBHOOK_SECRET" />
        </ul>
        {stripe.kind === "live" ? (
          <p className="text-sm text-destructive">The Stripe key is a live key. Merch checkout will refuse it.</p>
        ) : null}
        {!muxConfigured(env) ? (
          <p className="text-sm text-muted-foreground">
            In Mux, create a live stream with a public playback policy. In Ecamm Live or OBS, set the server to{" "}
            <code>rtmp://global-live.mux.com:5222/app</code> and paste the stream key from Mux. Keys stay in the host
            environment. They are not stored in the app or the database.
          </p>
        ) : null}
      </section>
    </div>
  );
}
