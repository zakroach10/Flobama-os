import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import {
  PHOTO_BOOTH_IP_LIMIT,
  PHOTO_BOOTH_MAX_BYTES,
  PHOTO_BOOTH_RETENTION_MS,
  PHOTO_BOOTH_TIME_ZONE,
  PHOTO_BOOTH_VENUE_LIMIT,
  photoBoothExpiresAt,
  photoBoothIdleMs,
} from "@/lib/photo-booth/constants";
import {
  coverSourceRect,
  formatPhotoBoothWhen,
  isJpeg,
  pickCamera,
  sanitizePhotoBoothLabel,
  scoreCameraLabel,
} from "@/lib/photo-booth/frame";
import { photoBoothShareOrigin } from "@/lib/photo-booth/origin";
import type { PhotoBoothCaptureRow, PhotoBoothRepository } from "@/lib/photo-booth/repository";
import {
  acceptPhotoBoothUpload,
  purgeExpiredPhotoBoothCaptures,
  resolvePhotoBoothShare,
} from "@/lib/photo-booth/service";
import { createPhotoBoothToken, hashPhotoBoothToken, isPhotoBoothTokenShape } from "@/lib/photo-booth/token";

const TINY_JPEG = Uint8Array.from(
  Buffer.from(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda00080001000100003f00fbffd9",
    "hex",
  ),
);

describe("photo booth frame", () => {
  it("uses the venue time zone and the documented idle windows", () => {
    expect(PHOTO_BOOTH_TIME_ZONE).toBe(DEFAULT_VENUE_TIMEZONE);
    expect(photoBoothIdleMs("preview")).toBe(90_000);
    expect(photoBoothIdleMs("review")).toBe(60_000);
    expect(photoBoothIdleMs("share")).toBe(45_000);
    expect(photoBoothIdleMs("error")).toBe(30_000);
    expect(formatPhotoBoothWhen(new Date("2026-11-12T23:03:00Z"))).toBe("Thu Nov 12 · 5:03 PM");
  });

  it("center-crops landscape and portrait webcams into the portrait still", () => {
    const landscape = coverSourceRect(1920, 1080, 1080, 1320);
    expect(landscape.sy).toBe(0);
    expect(landscape.sx).toBeGreaterThan(0);
    expect(landscape.sh).toBeCloseTo(1080);

    const portrait = coverSourceRect(1080, 1920, 1080, 1320);
    expect(portrait.sx).toBe(0);
    expect(portrait.sy).toBeCloseTo(300);
  });

  it("prefers a Mevo over a built-in camera unless staff saved one", () => {
    const devices = [
      { deviceId: "front", label: "Front Camera" },
      { deviceId: "mevo", label: "Mevo Start" },
      { deviceId: "obs", label: "OBS Virtual Camera" },
    ];
    expect(scoreCameraLabel("Mevo Core")).toBeGreaterThan(scoreCameraLabel("USB Webcam"));
    expect(pickCamera(devices, null)).toBe("mevo");
    expect(pickCamera(devices, "front")).toBe("front");
    expect(pickCamera(devices, "unplugged")).toBe("mevo");
    expect(pickCamera([], null)).toBeNull();
  });

  it("sanitizes the show name drawn on the frame", () => {
    expect(sanitizePhotoBoothLabel("  Tonight\nLive  ")).toBe("Tonight Live");
    expect(sanitizePhotoBoothLabel("x".repeat(80))?.length).toBe(60);
    expect(sanitizePhotoBoothLabel("   ")).toBeNull();
    expect(sanitizePhotoBoothLabel(null)).toBeNull();
  });

  it("accepts a real JPEG and rejects a renamed file", () => {
    expect(isJpeg(TINY_JPEG)).toBe(true);
    expect(isJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe(false);
    expect(isJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});

describe("photo booth share origin", () => {
  it("keeps the token on a known host", () => {
    const fallback = "https://flobama-os.vercel.app";
    expect(originOf("evil.example", fallback)).toBe(fallback);
    expect(originOf("localhost:43123", fallback)).toBe("http://localhost:43123");
    expect(originOf("admin.flobamadowntown.com", fallback)).toBe("https://admin.flobamadowntown.com");
    expect(originOf("preview.vercel.app", fallback, "preview.vercel.app")).toBe("https://preview.vercel.app");
    expect(originOf("other.vercel.app", fallback, "preview.vercel.app")).toBe(fallback);
  });
});

describe("photo booth storage", () => {
  const sql = readFileSync("supabase/migrations/20261112000069_photo_booth.sql", "utf8");

  it("keeps the bucket private and unpublished", () => {
    expect(sql).toContain(String(PHOTO_BOOTH_MAX_BYTES));
    expect(sql).toMatch(/'photo-booth',\s*\n?\s*'photo-booth',\s*false/);
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/create policy photo_booth/i);
    expect(sql).toContain("revoke all on table public.photo_booth_captures");
  });

  it("stores a hash, expires in 48 hours, and never keeps the token", async () => {
    const repo = memoryRepo();
    const now = new Date("2026-11-12T23:00:00Z");
    const token = createPhotoBoothToken();
    const result = await acceptPhotoBoothUpload(repo, {
      bytes: TINY_JPEG,
      eventLabel: "  The Shoals \n Band ",
      clientKey: "ip:test",
      now,
      venueId: "11111111-1111-4111-8111-111111111111",
      id: "22222222-2222-4222-8222-222222222222",
      token,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toBe(token);
    expect(Date.parse(result.expiresAt) - now.getTime()).toBe(PHOTO_BOOTH_RETENTION_MS);
    expect(repo.captures[0]?.tokenHash).toBe(hashPhotoBoothToken(token));
    expect(repo.captures[0]?.tokenHash).not.toBe(token);
    expect(repo.objects.has(repo.captures[0]?.storagePath ?? "")).toBe(true);
    expect(repo.captures[0]?.eventLabel).toBe("The Shoals Band");
    expect(isPhotoBoothTokenShape(token)).toBe(true);

    const share = await resolvePhotoBoothShare(repo, token, now);
    expect(share.ok).toBe(true);
  });

  it("rejects junk, oversize files, and a booth that is over its pace", async () => {
    const repo = memoryRepo();
    const now = new Date("2026-11-12T23:00:00Z");
    const base = {
      eventLabel: null,
      clientKey: "ip:test",
      now,
      venueId: "11111111-1111-4111-8111-111111111111",
    };
    const junk = await acceptPhotoBoothUpload(repo, { ...base, bytes: Uint8Array.from([1, 2, 3, 4]) });
    expect(junk.ok).toBe(false);
    if (!junk.ok) expect(junk.status).toBe(400);
    expect(repo.captures).toHaveLength(0);

    const huge = new Uint8Array(PHOTO_BOOTH_MAX_BYTES + 1);
    huge.set(TINY_JPEG);
    const oversize = await acceptPhotoBoothUpload(repo, { ...base, bytes: huge });
    expect(oversize.ok).toBe(false);
    if (!oversize.ok) expect(oversize.status).toBe(413);

    for (let i = 0; i < PHOTO_BOOTH_IP_LIMIT; i += 1) {
      const saved = await acceptPhotoBoothUpload(repo, { ...base, bytes: TINY_JPEG });
      expect(saved.ok).toBe(true);
    }
    const limited = await acceptPhotoBoothUpload(repo, { ...base, bytes: TINY_JPEG });
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.status).toBe(429);
  });

  it("stops a multi-address flood at the venue cap", async () => {
    const repo = memoryRepo();
    const now = new Date("2026-11-12T23:00:00Z");
    for (let i = 0; i < PHOTO_BOOTH_VENUE_LIMIT; i += 1) {
      const saved = await acceptPhotoBoothUpload(repo, {
        bytes: TINY_JPEG,
        eventLabel: null,
        clientKey: `ip:${i}`,
        now,
        venueId: "11111111-1111-4111-8111-111111111111",
      });
      expect(saved.ok).toBe(true);
    }
    const blocked = await acceptPhotoBoothUpload(repo, {
      bytes: TINY_JPEG,
      eventLabel: null,
      clientKey: "ip:new",
      now,
      venueId: "11111111-1111-4111-8111-111111111111",
    });
    expect(blocked.ok).toBe(false);
  });

  it("deletes the file when the row insert fails", async () => {
    const repo = memoryRepo();
    repo.failInsert = true;
    const result = await acceptPhotoBoothUpload(repo, {
      bytes: TINY_JPEG,
      eventLabel: null,
      clientKey: "ip:test",
      now: new Date(),
      venueId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.ok).toBe(false);
    expect(repo.objects.size).toBe(0);
    expect(repo.captures).toHaveLength(0);
  });

  it("hides unknown links and purges expired photos", async () => {
    const repo = memoryRepo();
    const created = new Date("2026-11-12T12:00:00Z");
    const token = createPhotoBoothToken();
    await acceptPhotoBoothUpload(repo, {
      bytes: TINY_JPEG,
      eventLabel: null,
      clientKey: "ip:test",
      now: created,
      venueId: "11111111-1111-4111-8111-111111111111",
      token,
    });
    const lookupsBefore = repo.lookups;
    const missing = await resolvePhotoBoothShare(repo, "not-a-token", created);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(404);
    expect(repo.lookups).toBe(lookupsBefore);

    const later = new Date(created.getTime() + PHOTO_BOOTH_RETENTION_MS + 1000);
    const expired = await resolvePhotoBoothShare(repo, token, later);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.status).toBe(410);
    expect(repo.objects.size).toBe(0);
    expect(repo.captures[0]?.purgedAt).toBeTruthy();

    const again = await purgeExpiredPhotoBoothCaptures(repo, later, 10);
    expect(again.purged).toBe(0);
  });

  it("expires the share link at the retention boundary", () => {
    const now = new Date("2026-11-12T23:00:00Z");
    expect(photoBoothExpiresAt(now).getTime() - now.getTime()).toBe(48 * 60 * 60 * 1000);
  });
});

function originOf(host: string, fallback: string, deploymentHost?: string) {
  return photoBoothShareOrigin(new Request("https://flobama-os.vercel.app/api", { headers: { host } }), fallback, deploymentHost);
}

function memoryRepo(): PhotoBoothRepository & {
  captures: PhotoBoothCaptureRow[];
  objects: Map<string, Uint8Array>;
  hits: { bucketKey: string; at: string }[];
  lookups: number;
  failInsert: boolean;
} {
  const captures: PhotoBoothCaptureRow[] = [];
  const objects = new Map<string, Uint8Array>();
  const hits: { bucketKey: string; at: string }[] = [];
  const repo = {
    captures,
    objects,
    hits,
    lookups: 0,
    failInsert: false,
    async countHits(bucketKey: string, sinceIso: string) {
      return hits.filter((hit) => hit.bucketKey === bucketKey && hit.at >= sinceIso).length;
    },
    async insertHit(bucketKey: string, atIso: string) {
      hits.push({ bucketKey, at: atIso });
    },
    async deleteHitsBefore(beforeIso: string) {
      for (let i = hits.length - 1; i >= 0; i -= 1) {
        if (hits[i]?.at < beforeIso) hits.splice(i, 1);
      }
    },
    async uploadJpeg(path: string, bytes: Uint8Array) {
      objects.set(path, bytes);
      return { error: null };
    },
    async deleteObject(path: string) {
      objects.delete(path);
      return { error: null };
    },
    async downloadJpeg(path: string) {
      const bytes = objects.get(path) ?? null;
      return { bytes, error: bytes ? null : "not found" };
    },
    async insertCapture(row: PhotoBoothCaptureRow) {
      if (repo.failInsert) return { error: "insert failed" };
      captures.push({ ...row, purgedAt: null });
      return { error: null };
    },
    async findByTokenHash(tokenHash: string) {
      repo.lookups += 1;
      return captures.find((row) => row.tokenHash === tokenHash) ?? null;
    },
    async listDueForPurge(nowIso: string) {
      return captures.filter((row) => !row.purgedAt && row.expiresAt <= nowIso);
    },
    async markPurged(id: string, atIso: string) {
      const row = captures.find((capture) => capture.id === id);
      if (row) row.purgedAt = atIso;
    },
  };
  return repo;
}
