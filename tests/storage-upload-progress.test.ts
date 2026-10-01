import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { uploadStorageObjectWithProgress } from "@/lib/screens/storage-upload-progress";

class FakeXHR {
  static last: FakeXHR | null = null;
  static instances: FakeXHR[] = [];

  status = 0;
  responseText = "";
  responseType = "";
  upload = {
    onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn((body: Blob) => {
    FakeXHR.last = this;
    FakeXHR.instances.push(this);
    queueMicrotask(() => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: Math.floor(body.size / 2),
        total: body.size,
      } as ProgressEvent);
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: body.size,
        total: body.size,
      } as ProgressEvent);
      this.status = 200;
      this.responseText = JSON.stringify({ Key: "screen-ads/path.mp4" });
      this.onload?.();
    });
  });
}

describe("uploadStorageObjectWithProgress", () => {
  const originalXHR = globalThis.XMLHttpRequest;

  beforeEach(() => {
    FakeXHR.last = null;
    FakeXHR.instances = [];
    // @ts-expect-error test double
    globalThis.XMLHttpRequest = FakeXHR;
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXHR;
  });

  it("reports percent progress and succeeds", async () => {
    const percents: number[] = [];
    const file = new Blob(["abcdefghij"], { type: "video/mp4" });
    const result = await uploadStorageObjectWithProgress({
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "token" } },
            error: null,
          }),
        },
      } as never,
      supabaseEnv: { url: "https://example.supabase.co", anonKey: "anon" },
      bucket: "screen-ads",
      path: "venue/led/artists/file.mp4",
      file,
      contentType: "video/mp4",
      onProgress: (progress) => percents.push(progress.percent),
    });

    expect(result).toEqual({ ok: true });
    expect(percents[0]).toBe(0);
    expect(percents).toContain(50);
    expect(percents.at(-1)).toBe(100);
    expect(FakeXHR.last?.open).toHaveBeenCalledWith(
      "POST",
      "https://example.supabase.co/storage/v1/object/screen-ads/venue/led/artists/file.mp4",
    );
    expect(FakeXHR.last?.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer token");
    expect(FakeXHR.last?.setRequestHeader).toHaveBeenCalledWith("content-type", "video/mp4");
  });
});
