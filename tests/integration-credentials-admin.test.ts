import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_STUDIO_SCOPES,
  INTEGRATION_SCOPE_LABELS,
  isMissingIntegrationRelation,
} from "@/lib/integrations/credentials-admin";
import { createIntegrationCredentialSchema } from "@/lib/validation/schemas";
import { createIntegrationToken, hashIntegrationToken, integrationTokenPrefix } from "@/lib/integrations/crypto";
import { EVENT_INTEGRATION_SQL } from "@/lib/constants";

describe("integration credential admin helpers", () => {
  it("defaults AI Studio scopes without artwork write", () => {
    expect(DEFAULT_AI_STUDIO_SCOPES).toEqual(["events:read", "events:write", "artists:read"]);
    expect(DEFAULT_AI_STUDIO_SCOPES).not.toContain("artwork:write");
    expect(INTEGRATION_SCOPE_LABELS["events:write"]).toMatch(/create/i);
  });

  it("accepts create payloads with the selected scopes", () => {
    const parsed = createIntegrationCredentialSchema.safeParse({
      name: "HighLevel AI Studio",
      scopes: DEFAULT_AI_STUDIO_SCOPES,
    });
    expect(parsed.success).toBe(true);
    const empty = createIntegrationCredentialSchema.safeParse({ name: "x", scopes: [] });
    expect(empty.success).toBe(false);
  });

  it("hashes tokens the same way the API verifies them", () => {
    const token = createIntegrationToken();
    expect(token.startsWith("fbint_")).toBe(true);
    expect(integrationTokenPrefix(token)).toHaveLength(12);
    expect(hashIntegrationToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("points operators at the event integration migration", () => {
    expect(isMissingIntegrationRelation('relation "integration_credentials" does not exist')).toBe(true);
    expect(EVENT_INTEGRATION_SQL).toContain("20261103000063_event_integration.sql");
  });
});
