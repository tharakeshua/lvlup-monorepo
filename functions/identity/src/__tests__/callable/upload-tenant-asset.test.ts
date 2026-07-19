/**
 * Unit tests for uploadTenantAsset callable.
 * Tests auth, permission checks, content type validation,
 * file path generation, and signed URL response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockGetSignedUrl = vi.fn();
const mockBucketFile = vi.fn();

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => ({
    collection: () => ({
      doc: () => ({
        id: "auto-id",
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      }),
    }),
    doc: (path: string) => ({
      id: path.split("/").pop(),
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    }),
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT(${n})`,
  };
  firestoreFn.Timestamp = { now: () => ({ toDate: () => new Date() }) };
  const storageFn = () => ({
    bucket: () => ({
      file: (p: string) => {
        mockBucketFile(p);
        return { getSignedUrl: mockGetSignedUrl };
      },
      name: "test-bucket",
    }),
  });
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
      storage: storageFn,
    },
    firestore: firestoreFn,
    storage: storageFn,
    initializeApp: vi.fn(),
  };
});

// ── Mock utils ──────────────────────────────────────────────────────
const mockAssertTenantAdminOrSuperAdmin = vi.fn();
const mockParseRequest = vi.fn((data: any, _schema: any) => data);

vi.mock("../../utils", () => ({
  assertTenantAdminOrSuperAdmin: (...args: unknown[]) => mockAssertTenantAdminOrSuperAdmin(...args),
  parseRequest: (...args: unknown[]) => mockParseRequest(...args),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

// ── Mock firebase-functions ─────────────────────────────────────────
vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: any) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ─────────────────────────────────────────────
import { uploadTenantAsset } from "../../callable/upload-tenant-asset";

const handler = uploadTenantAsset as unknown as (request: any) => Promise<any>;

describe("uploadTenantAsset", () => {
  const callerUid = "admin-uid";
  const tenantId = "tenant-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertTenantAdminOrSuperAdmin.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue(["https://storage.googleapis.com/signed-url"]);
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    await expect(
      handler({
        auth: null,
        data: { tenantId, assetType: "logo", contentType: "image/png" },
      })
    ).rejects.toThrow("Must be logged in");
  });

  it("throws permission-denied when caller is not admin", async () => {
    mockAssertTenantAdminOrSuperAdmin.mockRejectedValue(
      new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin")
    );

    await expect(
      handler({
        auth: { uid: "random-user" },
        data: { tenantId, assetType: "logo", contentType: "image/png" },
      })
    ).rejects.toThrow("Must be TenantAdmin or SuperAdmin");
  });

  // ── Content Type Validation ───────────────────────────────────────

  it("throws invalid-argument for disallowed content type", async () => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { tenantId, assetType: "logo", contentType: "application/pdf" },
      })
    ).rejects.toThrow("Invalid content type");
  });

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/svg+xml", "svg"],
    ["image/webp", "webp"],
  ])("accepts valid content type %s", async (contentType, _ext) => {
    await expect(
      handler({
        auth: { uid: callerUid },
        data: { tenantId, assetType: "logo", contentType },
      })
    ).resolves.toBeDefined();
  });

  // ── File Path ─────────────────────────────────────────────────────

  it("generates correct file path with tenantId, assetType, and extension", async () => {
    const beforeTimestamp = Date.now();

    await handler({
      auth: { uid: callerUid },
      data: { tenantId, assetType: "banner", contentType: "image/jpeg" },
    });

    const afterTimestamp = Date.now();

    // Verify bucket.file was called with the correct path pattern
    expect(mockBucketFile).toHaveBeenCalledTimes(1);
    const filePath = mockBucketFile.mock.calls[0][0] as string;
    expect(filePath).toMatch(new RegExp(`^tenants/${tenantId}/branding/banner-\\d+\\.jpg$`));

    // Verify the timestamp portion is within range
    const timestampMatch = filePath.match(/banner-(\d+)\.jpg/);
    expect(timestampMatch).not.toBeNull();
    const ts = Number(timestampMatch![1]);
    expect(ts).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(ts).toBeLessThanOrEqual(afterTimestamp);
  });

  // ── Response ──────────────────────────────────────────────────────

  it("returns uploadUrl from getSignedUrl result", async () => {
    mockGetSignedUrl.mockResolvedValue(["https://storage.googleapis.com/upload-signed"]);

    const result = await handler({
      auth: { uid: callerUid },
      data: { tenantId, assetType: "logo", contentType: "image/png" },
    });

    expect(result.uploadUrl).toBe("https://storage.googleapis.com/upload-signed");
  });

  it("returns publicUrl with correct bucket and file path format", async () => {
    const result = await handler({
      auth: { uid: callerUid },
      data: { tenantId, assetType: "favicon", contentType: "image/webp" },
    });

    expect(result.publicUrl).toMatch(
      new RegExp(
        `^https://storage\\.googleapis\\.com/test-bucket/tenants/${tenantId}/branding/favicon-\\d+\\.webp$`
      )
    );
  });

  // ── Signed URL Options ────────────────────────────────────────────

  it("calls getSignedUrl with v4, write action, and 15-minute expiry", async () => {
    const beforeTimestamp = Date.now();

    await handler({
      auth: { uid: callerUid },
      data: { tenantId, assetType: "logo", contentType: "image/png" },
    });

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    const opts = mockGetSignedUrl.mock.calls[0][0];
    expect(opts.version).toBe("v4");
    expect(opts.action).toBe("write");
    expect(opts.contentType).toBe("image/png");

    // Verify expiry is ~15 minutes from now
    const fifteenMinMs = 15 * 60 * 1000;
    const expectedExpiry = beforeTimestamp + fifteenMinMs;
    expect(opts.expires).toBeGreaterThanOrEqual(expectedExpiry);
    expect(opts.expires).toBeLessThanOrEqual(expectedExpiry + 1000);
  });
});
