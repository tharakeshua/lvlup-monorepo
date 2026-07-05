/**
 * P0-D pin: the `ctx.storage.signUploadUrl` hook contract
 * (`requestUploadUrlService` seam) over the Admin-SDK signer — V4 signed PUT,
 * contentType-bound, expiry = now + ttlMs, service-computed path passed through
 * untouched. Without this hook the service returns its `https://storage.local/…`
 * stub in PROD (the live-diagnosed defect).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSignedUrl = vi.fn(async (_opts: unknown) => ["https://signed.example/put"] as const);
const file = vi.fn((_path: string) => ({ getSignedUrl }));
const bucket = vi.fn((_name?: string) => ({ file }));

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket }),
}));

import { createAdminStorageSigner } from "./storage.js";

beforeEach(() => {
  getSignedUrl.mockClear();
  file.mockClear();
  bucket.mockClear();
});

describe("createAdminStorageSigner", () => {
  it("signs a V4 PUT bound to the exact path + contentType with a now+ttl expiry", async () => {
    const before = Date.now();
    const url = await createAdminStorageSigner().signUploadUrl(
      "tenants/t1/exams/e1/answer-sheets/s1/abc.jpg",
      "image/jpeg",
      15 * 60 * 1000
    );
    const after = Date.now();

    expect(url).toBe("https://signed.example/put");
    expect(bucket).toHaveBeenCalledWith(); // default bucket (FIREBASE_CONFIG)
    expect(file).toHaveBeenCalledWith("tenants/t1/exams/e1/answer-sheets/s1/abc.jpg");

    const opts = getSignedUrl.mock.calls[0]![0] as {
      version: string;
      action: string;
      contentType: string;
      expires: number;
    };
    expect(opts.version).toBe("v4");
    expect(opts.action).toBe("write");
    expect(opts.contentType).toBe("image/jpeg");
    expect(opts.expires).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(opts.expires).toBeLessThanOrEqual(after + 15 * 60 * 1000);
  });

  it("honors an explicit bucket override", async () => {
    await createAdminStorageSigner("my-bucket").signUploadUrl("p", "image/png", 1000);
    expect(bucket).toHaveBeenCalledWith("my-bucket");
  });
});
