import { describe, expect, it } from "vitest";
import {
  isProductionCommandExpired,
  validateEcammCallEndpoint,
} from "@/lib/production/commands";
import { NON_IDEMPOTENT_ECAMM_ACTIONS } from "@/lib/production/ecamm-endpoints";
import { productionCommandStatusLabel } from "@/lib/production/types";
import { authorizeProductionConfigure, authorizeProductionControl, authorizeProductionView } from "@/lib/auth/permissions";

describe("production command semantics", () => {
  it("expires pending commands by TTL", () => {
    expect(isProductionCommandExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isProductionCommandExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });

  it("marks dangerous actions non-idempotent", () => {
    expect(NON_IDEMPOTENT_ECAMM_ACTIONS.has("setClickButton")).toBe(true);
    expect(NON_IDEMPOTENT_ECAMM_ACTIONS.has("setZoomLeave")).toBe(true);
    expect(NON_IDEMPOTENT_ECAMM_ACTIONS.has("setScene")).toBe(false);
  });

  it("maps statuses without presenting accepted as confirmed", () => {
    expect(productionCommandStatusLabel("acknowledged")).toBe("acknowledged");
    expect(productionCommandStatusLabel("confirmed")).toBe("confirmed");
    expect(productionCommandStatusLabel("sent")).toBe("sent");
    expect(productionCommandStatusLabel("uncertain")).toBe("unknown");
  });

  it("rejects unknown endpoints", () => {
    const bad = validateEcammCallEndpoint("setArbitraryShell");
    expect(bad.ok).toBe(false);
  });
});

describe("production permissions", () => {
  it("allows viewers to view but not control", () => {
    expect(authorizeProductionView("viewer").allowed).toBe(true);
    expect(authorizeProductionControl("viewer").allowed).toBe(false);
    expect(authorizeProductionConfigure("viewer").allowed).toBe(false);
  });

  it("allows managers to control but not configure devices", () => {
    expect(authorizeProductionControl("manager").allowed).toBe(true);
    expect(authorizeProductionConfigure("manager").allowed).toBe(false);
    expect(authorizeProductionConfigure("admin").allowed).toBe(true);
  });

  it("denies server role production controls by default", () => {
    expect(authorizeProductionView("server").allowed).toBe(false);
    expect(authorizeProductionControl("server").allowed).toBe(false);
  });
});
