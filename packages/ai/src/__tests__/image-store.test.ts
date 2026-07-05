/**
 * FIX-1 P0-B — the storage→bytes image seam. Locks that `{ storagePath }` refs
 * resolve to REAL inline base64 bytes (never the path string itself), that the
 * inline budget + missing-store cases fail loudly, and that mime inference works.
 */
import { describe, it, expect, vi } from "vitest";
import {
  resolveImages,
  inferMimeType,
  createStubImageStore,
  type AiImageStore,
} from "../images/image-store.js";
import { isAiGatewayError } from "../errors.js";

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

function makeStore(
  over: Partial<Record<string, { bytes: Uint8Array; contentType?: string }>> = {}
) {
  const reads: string[] = [];
  const store: AiImageStore = {
    async read(path: string) {
      reads.push(path);
      const entry = over[path];
      if (!entry) throw new Error(`object not found: ${path}`);
      return entry;
    },
  };
  return { store, reads };
}

describe("resolveImages (path → bytes seam)", () => {
  it("downloads storagePath refs and inlines REAL base64 bytes (not the path)", async () => {
    const path = "v2_tenants/t1/exams/e1/paper/p1.png";
    const { store, reads } = makeStore({ [path]: { bytes: PNG_BYTES, contentType: "image/png" } });

    const out = await resolveImages([{ storagePath: path }], { store });

    expect(reads).toEqual([path]);
    expect(out).toHaveLength(1);
    expect(out![0]!.base64).toBe(Buffer.from(PNG_BYTES).toString("base64"));
    expect(out![0]!.base64).not.toContain(path);
    expect(out![0]!.mimeType).toBe("image/png");
  });

  it("prefers explicit mimeType, then storage contentType, then extension inference", async () => {
    const { store } = makeStore({
      "a.png": { bytes: PNG_BYTES, contentType: "image/png" },
      "b.webp": { bytes: PNG_BYTES },
    });
    const out = await resolveImages(
      [{ storagePath: "a.png", mimeType: "image/x-forced" }, { storagePath: "b.webp" }],
      { store }
    );
    expect(out![0]!.mimeType).toBe("image/x-forced");
    expect(out![1]!.mimeType).toBe("image/webp");
  });

  it("passes pre-encoded base64 refs through untouched", async () => {
    const ref = { base64: "aGVsbG8=", mimeType: "image/jpeg" };
    const out = await resolveImages([ref]);
    expect(out).toEqual([ref]);
  });

  it("returns undefined for absent/empty image lists", async () => {
    expect(await resolveImages(undefined)).toBeUndefined();
    expect(await resolveImages([])).toBeUndefined();
  });

  it("fails with PRECONDITION_FAILED when a storagePath ref arrives with no store wired", async () => {
    await expect(resolveImages([{ storagePath: "x.jpg" }])).rejects.toSatisfy(
      (e: unknown) => isAiGatewayError(e) && e.code === "PRECONDITION_FAILED" && !e.retryable
    );
  });

  it("fails with PRECONDITION_FAILED when the store read throws (object missing)", async () => {
    const { store } = makeStore();
    await expect(resolveImages([{ storagePath: "missing.jpg" }], { store })).rejects.toSatisfy(
      (e: unknown) => isAiGatewayError(e) && e.code === "PRECONDITION_FAILED"
    );
  });

  it("enforces the summed raw-byte inline budget across all refs", async () => {
    const big = new Uint8Array(1024); // 1KB per image, 3KB budget
    const { store } = makeStore({
      "1.jpg": { bytes: big },
      "2.jpg": { bytes: big },
      "3.jpg": { bytes: big },
      "4.jpg": { bytes: big },
    });
    const refs = ["1.jpg", "2.jpg", "3.jpg", "4.jpg"].map((storagePath) => ({ storagePath }));
    await expect(resolveImages(refs, { store, maxTotalBytes: 3 * 1024 })).rejects.toSatisfy(
      (e: unknown) => isAiGatewayError(e) && e.code === "PRECONDITION_FAILED" && !e.retryable
    );
    // Under budget the same refs resolve fine.
    const ok = await resolveImages(refs.slice(0, 2), { store, maxTotalBytes: 3 * 1024 });
    expect(ok).toHaveLength(2);
  });

  it("downloads sequentially (never N parallel reads)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const store: AiImageStore = {
      read: vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return { bytes: PNG_BYTES };
      }),
    };
    await resolveImages(
      [{ storagePath: "1.jpg" }, { storagePath: "2.jpg" }, { storagePath: "3.jpg" }],
      { store }
    );
    expect(maxInFlight).toBe(1);
  });
});

describe("inferMimeType", () => {
  it("maps known extensions and defaults to image/jpeg", () => {
    expect(inferMimeType("a/b/c.PNG")).toBe("image/png");
    expect(inferMimeType("scan.pdf")).toBe("application/pdf");
    expect(inferMimeType("no-extension")).toBe("image/jpeg");
  });
});

describe("createStubImageStore", () => {
  it("resolves any path deterministically with a content type", async () => {
    const store = createStubImageStore();
    const a = await store.read("any/path/p.png");
    const b = await store.read("any/path/p.png");
    expect(a.bytes).toEqual(b.bytes);
    expect(a.contentType).toBe("image/png");
  });
});
