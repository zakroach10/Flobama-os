import { afterEach, describe, expect, it } from "vitest";
import {
  issueWallLedUploadToken,
  verifyWallLedUploadToken,
  WALL_LED_UPLOAD_TTL_SECONDS,
} from "@/lib/screens/wall-upload-token";
import { canUploadLedWallMedia } from "@/lib/auth/permissions";

describe("wall LED upload tokens", () => {
  const previousCron = process.env.CRON_SECRET;
  const previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (previousCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCron;
    if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
  });

  it("signs and verifies a short-lived phone upload token", () => {
    process.env.CRON_SECRET = "test-cron-secret-for-wall-upload";
    const token = issueWallLedUploadToken("11111111-1111-4111-8111-111111111111");
    expect(token).toBeTruthy();
    const verified = verifyWallLedUploadToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.venueId).toBe("11111111-1111-4111-8111-111111111111");
      expect(verified.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it("rejects tampered or expired tokens", () => {
    process.env.CRON_SECRET = "test-cron-secret-for-wall-upload";
    const token = issueWallLedUploadToken("11111111-1111-4111-8111-111111111111");
    expect(token).toBeTruthy();
    expect(verifyWallLedUploadToken(`${token}x`).ok).toBe(false);

    const past = Date.now() - (WALL_LED_UPLOAD_TTL_SECONDS + 5) * 1000;
    const expired = issueWallLedUploadToken("11111111-1111-4111-8111-111111111111", past);
    expect(expired).toBeTruthy();
    expect(verifyWallLedUploadToken(expired).ok).toBe(false);
  });
});

describe("LED media upload permissions", () => {
  it("lets wall-ops and managers upload media without full LED admin configure", () => {
    expect(canUploadLedWallMedia("admin")).toBe(true);
    expect(canUploadLedWallMedia("manager")).toBe(true);
    expect(
      canUploadLedWallMedia("viewer", "wall@flobama.example", {
        userId: "user-1",
        wallOpsUserId: "user-1",
      }),
    ).toBe(true);
    expect(canUploadLedWallMedia("viewer", "door@flobama.example")).toBe(false);
  });
});
