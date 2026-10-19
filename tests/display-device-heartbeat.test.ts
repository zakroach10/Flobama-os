import { describe, expect, it } from "vitest";
import { displayDeviceHeartbeatSchema } from "@/lib/validation/schemas";

describe("displayDeviceHeartbeatSchema", () => {
  it("accepts float ecamm viewers by rounding to an int", () => {
    const parsed = displayDeviceHeartbeatSchema.safeParse({
      appVersion: "1.3.1",
      ecamm: { connected: true, viewers: 12.7 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.ecamm?.viewers).toBe(13);
  });

  it("accepts numeric-string viewers and cache floats", () => {
    const parsed = displayDeviceHeartbeatSchema.safeParse({
      appVersion: "1.3.1",
      cache: { bytesUsed: 1024.9, bytesLimit: 5000, assetsReady: 2, assetsPending: 0 },
      ecamm: { connected: true, viewers: "8" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cache?.bytesUsed).toBe(1025);
      expect(parsed.data.ecamm?.viewers).toBe(8);
    }
  });

  it("normalizes lastScanAt without a Z suffix", () => {
    const parsed = displayDeviceHeartbeatSchema.safeParse({
      appVersion: "1.3.1",
      performance: { lastScanAt: "2026-10-19T03:00:00.000" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.performance?.lastScanAt).toMatch(/Z$/);
    }
  });

  it("drops array-shaped volumes instead of failing the heartbeat", () => {
    const parsed = displayDeviceHeartbeatSchema.safeParse({
      appVersion: "1.3.1",
      ecamm: { connected: true, volumes: [0.5, 0.2] },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.ecamm?.volumes).toBeUndefined();
  });

  it("keeps a basic LED runner heartbeat valid without ecamm", () => {
    const parsed = displayDeviceHeartbeatSchema.safeParse({
      appVersion: "1.3.1",
      obs: { connected: true, programScene: "Media", scenes: ["Media"] },
      cache: { bytesUsed: 0, bytesLimit: 1, assetsReady: 0, assetsPending: 0 },
      performance: { mode: "normal", revision: 1, audioMuted: false, audioVolume: 1, nowPlaying: null },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts overlong manifestRevision by truncating", () => {
    const long = `led|playlist|${"a".repeat(800)}`;
    const parsed = displayDeviceHeartbeatSchema.safeParse({
      appVersion: "1.3.2",
      manifestRevision: long,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.manifestRevision?.length).toBe(500);
    }
  });
});

