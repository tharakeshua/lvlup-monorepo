import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockUpload = vi.fn().mockResolvedValue([{}]);
const mockGetSignedUrl = vi.fn().mockResolvedValue(["https://storage.example.com/export.json"]);
const mockFile = vi.fn(() => ({
  save: mockUpload,
  getSignedUrl: mockGetSignedUrl,
}));
const mockBucket = { file: mockFile };

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    get: mockGet,
    doc: vi.fn(() => ({ get: mockGet })),
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") };
  return {
    default: {
      firestore: fsFn,
      storage: () => ({ bucket: () => mockBucket }),
      initializeApp: vi.fn(),
    },
    firestore: fsFn,
    storage: () => ({ bucket: () => mockBucket }),
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../utils", () => ({
  getUser: vi.fn().mockResolvedValue({ isSuperAdmin: true }),
  assertTenantAdminOrSuperAdmin: vi.fn().mockResolvedValue(undefined),
  parseRequest: vi.fn((data: any) => data),
  logTenantAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { exportTenantData } from "../../callable/export-tenant-data";
const handler = exportTenantData as any;

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "admin-1" }),
    rawRequest: {} as any,
  };
}

describe("exportTenantData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw unauthenticated when no auth", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1" }, null))).rejects.toThrow();
  });

  it("should throw when no collections specified", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1", collections: [] }))).rejects.toThrow();
  });

  it("should export tenant data as JSON", async () => {
    // Collection query returns docs
    mockGet.mockResolvedValueOnce({
      docs: [
        { id: "stu-1", data: () => ({ name: "Student 1", status: "active" }) },
        { id: "stu-2", data: () => ({ name: "Student 2", status: "active" }) },
      ],
    });

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        collections: ["students"],
        format: "json",
      })
    );

    expect(result).toBeDefined();
    expect(result.downloadUrl).toBeDefined();
    expect(mockUpload).toHaveBeenCalled();
  });

  it("should export tenant data as CSV", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [{ id: "stu-1", data: () => ({ name: "Student 1", email: "stu1@test.com" }) }],
    });

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        collections: ["students"],
        format: "csv",
      })
    );

    expect(result).toBeDefined();
    expect(result.downloadUrl).toBeDefined();
  });

  // ── B8 timestamp round-trip: every at-rest encoding → ISO string out ────────
  it("serializes every timestamp encoding to a canonical ISO string", async () => {
    const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const expectedIso = "2021-01-01T00:00:00.000Z";

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "stu-1",
          data: () => ({
            name: "Student 1",
            // old-format admin Firestore Timestamp (toDate + seconds/nanoseconds)
            createdAt: {
              seconds: 1609459200,
              nanoseconds: 0,
              toDate: () => new Date(1609459200 * 1000),
            },
            // serialized admin Timestamp over the wire
            serializedAt: { _seconds: 1609459200, _nanoseconds: 0 },
            // plain {seconds,nanoseconds} form
            plainAt: { seconds: 1609459200, nanoseconds: 0 },
            // new-format doc: already a canonical ISO string, passes through
            updatedAt: expectedIso,
            // ordinary nested object must recurse, not be treated as a timestamp
            profile: { grade: "10", section: "A" },
          }),
        },
      ],
    });

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        collections: ["students"],
        format: "json",
      })
    );

    // file.save(fileContent, ...) — the first arg is the serialized JSON payload.
    const payload = JSON.parse(mockUpload.mock.calls[0][0] as string);
    const record = payload.students[0];

    expect(record.createdAt).toBe(expectedIso);
    expect(record.serializedAt).toBe(expectedIso);
    expect(record.plainAt).toBe(expectedIso);
    expect(record.updatedAt).toBe(expectedIso);
    expect(record.createdAt).toMatch(ISO);
    // nested non-timestamp object is preserved (recursed), not collapsed
    expect(record.profile).toEqual({ grade: "10", section: "A" });
  });
});
