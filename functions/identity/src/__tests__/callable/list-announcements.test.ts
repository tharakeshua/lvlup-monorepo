/**
 * Unit tests for listAnnouncements callable.
 * Tests auth, scope routing, status filtering, pagination, and data mapping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockDocGet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();

const chainMock: any = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  get: mockGet,
};

// Each chaining method returns the chain
mockWhere.mockReturnValue(chainMock);
mockOrderBy.mockReturnValue(chainMock);
mockLimit.mockReturnValue(chainMock);
mockStartAfter.mockReturnValue(chainMock);

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockDocGet })),
  collection: vi.fn(() => chainMock),
};

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => stableDb;
  firestoreFn.FieldValue = {
    serverTimestamp: () => "SERVER_TIMESTAMP",
  };
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
      apps: [{}],
    },
    firestore: firestoreFn,
    initializeApp: vi.fn(),
    apps: [{}],
  };
});

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

// ── Mock utils ──────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockParseRequest = vi.fn();

vi.mock("../../utils", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  parseRequest: (...args: unknown[]) => mockParseRequest(...args),
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

import { listAnnouncements } from "../../callable/list-announcements";

const handler = listAnnouncements as unknown as (request: any) => Promise<any>;

// ── Helpers ─────────────────────────────────────────────────────────

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "user-1" }),
  };
}

function makeFakeDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    exists: true,
    data: () => data,
  };
}

function makeAnnouncementDoc(id: string, overrides: Record<string, unknown> = {}) {
  return makeFakeDoc(id, {
    title: `Announcement ${id}`,
    body: `Body of ${id}`,
    authorName: "Admin",
    scope: "platform",
    status: "published",
    targetRoles: ["teacher"],
    targetClassIds: [],
    publishedAt: "2025-01-15T00:00:00Z",
    archivedAt: null,
    expiresAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("listAnnouncements", () => {
  const callerUid = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire chain returns after clearAllMocks
    mockWhere.mockReturnValue(chainMock);
    mockOrderBy.mockReturnValue(chainMock);
    mockLimit.mockReturnValue(chainMock);
    mockStartAfter.mockReturnValue(chainMock);

    mockParseRequest.mockImplementation((data: any) => data);
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockGet.mockResolvedValue({ docs: [] });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    await expect(handler(makeRequest({}, null))).rejects.toThrow("Must be logged in");
  });

  // ── Basic listing ─────────────────────────────────────────────────

  it("returns announcements list", async () => {
    const docs = [makeAnnouncementDoc("a1"), makeAnnouncementDoc("a2")];
    mockGet.mockResolvedValue({ docs });

    const result = await handler(makeRequest({}));

    expect(result.announcements).toHaveLength(2);
    expect(result.announcements[0].id).toBe("a1");
    expect(result.announcements[1].id).toBe("a2");
  });

  // ── Status filtering for non-superadmin ───────────────────────────

  it("non-superadmin only sees published announcements", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({}));

    expect(mockWhere).toHaveBeenCalledWith("status", "==", "published");
  });

  it("superadmin sees all statuses when no status filter specified", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({}));

    // Where should NOT be called with a status filter for superadmin without explicit status
    expect(mockWhere).not.toHaveBeenCalledWith("status", "==", expect.anything());
  });

  // ── Explicit status filter ────────────────────────────────────────

  it("applies status filter when specified", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({ status: "draft" }));

    expect(mockWhere).toHaveBeenCalledWith("status", "==", "draft");
  });

  // ── Pagination ────────────────────────────────────────────────────

  it("cursor-based pagination uses startAfter", async () => {
    const cursorDoc = { exists: true };
    mockDocGet.mockResolvedValue(cursorDoc);
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({ cursor: "last-ann-id" }));

    // Should fetch the cursor document
    expect(stableDb.doc).toHaveBeenCalled();
    expect(mockStartAfter).toHaveBeenCalledWith(cursorDoc);
  });

  it("sets hasMore and nextCursor correctly when more results exist", async () => {
    // Default limit is 20, so fetch 21 to detect hasMore
    const docs = Array.from({ length: 21 }, (_, i) => makeAnnouncementDoc(`a-${i}`));
    mockGet.mockResolvedValue({ docs });

    const result = await handler(makeRequest({}));

    // Should return 20 (sliced from 21)
    expect(result.announcements).toHaveLength(20);
    expect(result.nextCursor).toBe("a-19");
  });

  it("nextCursor is undefined when no more results", async () => {
    const docs = [makeAnnouncementDoc("a1")];
    mockGet.mockResolvedValue({ docs });

    const result = await handler(makeRequest({}));

    expect(result.announcements).toHaveLength(1);
    expect(result.nextCursor).toBeUndefined();
  });

  // ── Default limit ─────────────────────────────────────────────────

  it("uses default limit of 20", async () => {
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({}));

    // limit is pageLimit + 1 = 21
    expect(mockLimit).toHaveBeenCalledWith(21);
  });

  // ── Data mapping ──────────────────────────────────────────────────

  it("maps document data correctly to announcement objects", async () => {
    const docs = [
      makeAnnouncementDoc("ann-1", {
        title: "Important Update",
        body: "Details here",
        authorName: "Principal",
        scope: "tenant",
        status: "published",
        targetRoles: ["teacher", "student"],
        targetClassIds: ["c1"],
        publishedAt: "2025-03-01T00:00:00Z",
        archivedAt: null,
        expiresAt: "2025-06-01T00:00:00Z",
        createdAt: "2025-02-28T00:00:00Z",
        updatedAt: "2025-03-01T00:00:00Z",
      }),
    ];
    mockGet.mockResolvedValue({ docs });

    const result = await handler(makeRequest({}));

    expect(result.announcements[0]).toEqual({
      id: "ann-1",
      title: "Important Update",
      body: "Details here",
      authorName: "Principal",
      scope: "tenant",
      status: "published",
      targetRoles: ["teacher", "student"],
      targetClassIds: ["c1"],
      // B8: timestamps out are canonical ISO strings (millis normalized).
      publishedAt: "2025-03-01T00:00:00.000Z",
      archivedAt: null,
      expiresAt: "2025-06-01T00:00:00.000Z",
      createdAt: "2025-02-28T00:00:00.000Z",
      updatedAt: "2025-03-01T00:00:00.000Z",
    });
  });

  // ── B8 timestamp round-trip ───────────────────────────────────────
  // A legacy doc whose createdAt is a Firestore Timestamp-like object
  // ({ seconds, nanoseconds }) must come out as a canonical ISO string.
  it("collapses legacy Firestore Timestamp objects to ISO strings", async () => {
    const docs = [
      makeAnnouncementDoc("legacy-1", {
        // 2024-06-01T12:00:00.000Z == 1717243200 epoch seconds
        createdAt: { seconds: 1717243200, nanoseconds: 0 },
        updatedAt: { seconds: 1717243200, nanoseconds: 0 },
        publishedAt: { seconds: 1717243200, nanoseconds: 0 },
        archivedAt: null,
        expiresAt: null,
      }),
    ];
    mockGet.mockResolvedValue({ docs });

    const result = await handler(makeRequest({}));

    expect(result.announcements[0].createdAt).toBe("2024-06-01T12:00:00.000Z");
    expect(result.announcements[0].updatedAt).toBe("2024-06-01T12:00:00.000Z");
    expect(result.announcements[0].publishedAt).toBe("2024-06-01T12:00:00.000Z");
    expect(result.announcements[0].archivedAt).toBeNull();
    expect(result.announcements[0].expiresAt).toBeNull();
  });

  // ── Scope routing ─────────────────────────────────────────────────

  it("platform scope uses top-level announcements collection", async () => {
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({ scope: "platform" }));

    expect(stableDb.collection).toHaveBeenCalledWith("announcements");
  });

  it("tenant scope uses tenants/{id}/announcements collection", async () => {
    mockGet.mockResolvedValue({ docs: [] });

    await handler(makeRequest({ tenantId: "tenant-1", scope: "tenant" }));

    expect(stableDb.collection).toHaveBeenCalledWith("tenants/tenant-1/announcements");
  });
});
