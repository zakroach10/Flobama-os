import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDisplayDeviceToken,
  createDisplayPairingCode,
  displaySecretsMatch,
  hashDisplaySecret,
  normalizeDisplayPairingCode,
} from "@/lib/display-devices/crypto";
import { isSha256Hex } from "@/lib/display-devices/hashes";
import { isDisplayDeviceStale } from "@/lib/display-devices/types";

describe("display device crypto", () => {
  it("hashes secrets as sha256 hex", () => {
    const value = "ABC12345";
    expect(hashDisplaySecret(value)).toBe(createHash("sha256").update(value).digest("hex"));
    expect(hashDisplaySecret(value)).toHaveLength(64);
  });

  it("matches secrets with timing-safe compare", () => {
    const token = createDisplayDeviceToken();
    const hash = hashDisplaySecret(token);
    expect(displaySecretsMatch(hash, token)).toBe(true);
    expect(displaySecretsMatch(hash, `${token}x`)).toBe(false);
  });

  it("creates fbdisp_ tokens and 8-char pairing codes", () => {
    expect(createDisplayDeviceToken().startsWith("fbdisp_")).toBe(true);
    const code = createDisplayPairingCode();
    expect(code).toHaveLength(8);
    expect(normalizeDisplayPairingCode(` ${code.toLowerCase()} `)).toBe(code);
  });
});

describe("display device status helpers", () => {
  it("marks missing or old heartbeats stale", () => {
    const now = Date.parse("2026-10-13T02:00:00.000Z");
    expect(isDisplayDeviceStale(null, now)).toBe(true);
    expect(isDisplayDeviceStale("2026-10-13T01:59:30.000Z", now)).toBe(false);
    expect(isDisplayDeviceStale("2026-10-13T01:58:00.000Z", now)).toBe(true);
  });

  it("validates sha256 hex", () => {
    expect(isSha256Hex("a".repeat(64))).toBe(true);
    expect(isSha256Hex("zz")).toBe(false);
    expect(isSha256Hex(null)).toBe(false);
  });
});
