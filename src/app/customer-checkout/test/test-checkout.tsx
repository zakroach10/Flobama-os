"use client";

import { useState } from "react";

export function TestCheckout({ orderId, token }: { orderId: string; token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/public/v1/customer/checkout/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, token }),
    });
    const body = (await response.json()) as { error?: string; order?: { status: string } };
    setPending(false);
    if (!response.ok) {
      setMessage(body.error || "Could not record the test order.");
      return;
    }
    setMessage(`Order ${body.order?.status}. No card was charged. Return to the FloBama app.`);
  }

  return (
    <div className="space-y-4">
      <p className="text-neutral-300">
        Stripe is not connected, so this is a test checkout. Nothing is charged.
      </p>
      <button
        type="button"
        onClick={() => void pay()}
        disabled={pending}
        className="rounded-full bg-amber-500 px-5 py-3 font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Place test order"}
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
