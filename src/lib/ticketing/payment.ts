import type { PaymentProvider, PaymentStatus } from "@/lib/ticketing/constants";

export type ChargeInput = {
  amountCents: number;
  email: string;
  description: string;
  mockFail?: boolean;
};

export type ChargeResult = {
  ok: boolean;
  provider: PaymentProvider;
  status: PaymentStatus;
  providerRef: string | null;
  error?: string;
};

export function getPaymentProvider(): PaymentProvider {
  return process.env.STRIPE_SECRET_KEY ? "stripe" : "mock";
}

export async function chargeCheckout(input: ChargeInput): Promise<ChargeResult> {
  if (process.env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      provider: "stripe",
      status: "failed",
      providerRef: null,
      error: "Stripe checkout is configured but not wired in V1. Unset STRIPE_SECRET_KEY to use the mock adapter.",
    };
  }
  if (input.mockFail || input.amountCents < 0) {
    return {
      ok: false,
      provider: "mock",
      status: "failed",
      providerRef: null,
      error: "Mock payment declined.",
    };
  }
  return {
    ok: true,
    provider: "mock",
    status: "succeeded",
    providerRef: `mock_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`,
  };
}
