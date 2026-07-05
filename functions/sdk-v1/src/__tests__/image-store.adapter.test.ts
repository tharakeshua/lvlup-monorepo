/**
 * FIX-3 pin: the concrete Admin-SDK `AiImageStore` bootstrap injects into
 * `createAiGateway({ imageStore })` — the composition-root half of the FIX-1
 * storagePath→bytes seam. Contract (mirrors the P0-D `signUploadUrl` hook pin):
 * the service-granted path is passed through VERBATIM to `bucket.file(path)`,
 * bytes come from `download()`, `contentType` propagates from `getMetadata()`,
 * and the DEFAULT bucket is used unless overridden — the same bucket/path
 * conventions `buildScopedPath` + `createAdminStorageSigner` write with.
 * Emulator/test mode instead gets `createStubImageStore()` (deterministic
 * bytes, NO Admin SDK), pinned here so the stub path never regresses into a
 * Storage-emulator dependency.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const download = vi.fn(async () => [Buffer.from([0xde, 0xad, 0xbe, 0xef])] as const);
const getMetadata = vi.fn(async () => [{ contentType: "image/png" }] as const);
const file = vi.fn((_path: string) => ({ download, getMetadata }));
const bucket = vi.fn((_name?: string) => ({ file }));

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket }),
}));

import { createAdminImageStore } from "../image-store.js";
import { createStubImageStore } from "@levelup/ai";

beforeEach(() => {
  download.mockClear();
  getMetadata.mockClear();
  file.mockClear();
  bucket.mockClear();
});

describe("createAdminImageStore (prod wiring)", () => {
  it("downloads the verbatim bucket-relative path from the DEFAULT bucket and propagates metadata contentType", async () => {
    const path = "tenants/t1/exams/e1/answer-sheets/s1/abc.jpg";
    const out = await createAdminImageStore().read(path);

    expect(bucket).toHaveBeenCalledWith(); // default bucket (FIREBASE_CONFIG) — signer symmetry
    expect(file).toHaveBeenCalledWith(path); // verbatim, no prefixing/rewriting
    expect(download).toHaveBeenCalledTimes(1);
    expect(getMetadata).toHaveBeenCalledTimes(1);

    expect(Buffer.from(out.bytes)).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    expect(out.contentType).toBe("image/png");
  });

  it("honors an explicit bucket override", async () => {
    await createAdminImageStore("my-bucket").read("tenants/t1/x.jpg");
    expect(bucket).toHaveBeenCalledWith("my-bucket");
  });

  it("omits contentType when object metadata lacks one (gateway falls back to extension inference)", async () => {
    getMetadata.mockResolvedValueOnce([{}] as never);
    const out = await createAdminImageStore().read("tenants/t1/scan.webp");
    expect(out.contentType).toBeUndefined();
    expect("contentType" in out).toBe(false);
  });

  it("propagates a storage read failure (the gateway wraps it as PRECONDITION_FAILED)", async () => {
    download.mockRejectedValueOnce(new Error("No such object"));
    await expect(createAdminImageStore().read("tenants/t1/missing.jpg")).rejects.toThrow(
      "No such object"
    );
  });
});

describe("createStubImageStore (emulator/test wiring)", () => {
  it("resolves ANY path deterministically without touching the Admin SDK bucket", async () => {
    const out = await createStubImageStore().read("tenants/t1/exams/e1/whatever.png");
    expect(out.bytes.byteLength).toBeGreaterThan(0);
    expect(out.contentType).toBe("image/png"); // inferred from extension, not metadata
    expect(bucket).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });
});
