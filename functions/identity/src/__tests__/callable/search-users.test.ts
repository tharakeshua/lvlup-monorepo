/**
 * Unit tests for searchUsers callable.
 * Tests auth, SuperAdmin gate, email/displayName search,
 * deduplication, limit handling, and membership info.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

// ── Mock firebase-admin ─────────────────────────────────────────────
const mockCollectionGet = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockStartAt = vi.fn();
const mockEndAt = vi.fn();
const mockLimit = vi.fn();

// Build a chainable collection mock
function makeChain() {
  const chain: any = {
    where: (...args: any[]) => {
      mockWhere(...args);
      return chain;
    },
    orderBy: (...args: any[]) => {
      mockOrderBy(...args);
      return chain;
    },
    startAt: (...args: any[]) => {
      mockStartAt(...args);
      return chain;
    },
    endAt: (...args: any[]) => {
      mockEndAt(...args);
      return chain;
    },
    limit: (...args: any[]) => {
      mockLimit(...args);
      return chain;
    },
    get: mockCollectionGet,
  };
  return chain;
}

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => ({
    collection: () => makeChain(),
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
  return {
    default: {
      firestore: firestoreFn,
      initializeApp: vi.fn(),
    },
    firestore: firestoreFn,
    initializeApp: vi.fn(),
  };
});

// ── Mock utils ──────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockParseRequest = vi.fn((data: any, _schema: any) => data);

vi.mock("../../utils", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
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
import { searchUsers } from "../../callable/search-users";

const handler = searchUsers as unknown as (request: any) => Promise<any>;

// ── Helpers ─────────────────────────────────────────────────────────
function makeUserDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("searchUsers", () => {
  const callerUid = "superadmin-uid";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ isSuperAdmin: true });
    // Default: all queries return empty
    mockCollectionGet.mockResolvedValue({ docs: [] });
  });

  // ── Auth ──────────────────────────────────────────────────────────

  it("throws unauthenticated when no auth provided", async () => {
    await expect(handler({ auth: null, data: { query: "test" } })).rejects.toThrow(
      "Must be logged in"
    );
  });

  it("throws permission-denied when non-superadmin calls", async () => {
    mockGetUser.mockResolvedValue({ isSuperAdmin: false });

    await expect(
      handler({ auth: { uid: "regular-user" }, data: { query: "test" } })
    ).rejects.toThrow("SuperAdmin only");
  });

  // ── Search ────────────────────────────────────────────────────────

  it("searches users by email prefix", async () => {
    const userDocs = [makeUserDoc("user-1", { email: "john@example.com", displayName: "John" })];
    // First get: email search returns 1 result (< 20 limit)
    mockCollectionGet.mockResolvedValueOnce({ docs: userDocs });
    // Second get: displayName search (triggered because email results < limit)
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    // Third get: membership query
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    const result = await handler({
      auth: { uid: callerUid },
      data: { query: "john" },
    });

    expect(result.users).toHaveLength(1);
    expect(result.users[0].email).toBe("john@example.com");
    expect(mockOrderBy).toHaveBeenCalledWith("email");
  });

  it("searches by displayName when few email results found", async () => {
    // Email search returns fewer results than limit (default 20)
    const emailDocs = [makeUserDoc("user-1", { email: "alice@test.com", displayName: "Alice" })];
    const nameDocs = [makeUserDoc("user-2", { email: "bob@test.com", displayName: "alice smith" })];

    // First get: email search (1 result < 20 limit)
    mockCollectionGet.mockResolvedValueOnce({ docs: emailDocs });
    // Second get: displayName search
    mockCollectionGet.mockResolvedValueOnce({ docs: nameDocs });
    // Third + Fourth get: membership queries for each user
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    const result = await handler({
      auth: { uid: callerUid },
      data: { query: "alice" },
    });

    expect(result.users).toHaveLength(2);
    // Verify displayName search was triggered
    expect(mockOrderBy).toHaveBeenCalledWith("displayName");
  });

  it("deduplicates results across email and displayName searches", async () => {
    const sharedDoc = makeUserDoc("user-1", { email: "sam@test.com", displayName: "sam jones" });

    // Email search returns user-1
    mockCollectionGet.mockResolvedValueOnce({ docs: [sharedDoc] });
    // displayName search also returns user-1 (duplicate)
    mockCollectionGet.mockResolvedValueOnce({ docs: [sharedDoc] });
    // Membership query for the single user
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    const result = await handler({
      auth: { uid: callerUid },
      data: { query: "sam" },
    });

    expect(result.users).toHaveLength(1);
  });

  it("uses default limit of 20 when not specified", async () => {
    mockCollectionGet.mockResolvedValue({ docs: [] });

    await handler({
      auth: { uid: callerUid },
      data: { query: "test" },
    });

    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("applies custom limit when provided", async () => {
    mockCollectionGet.mockResolvedValue({ docs: [] });

    await handler({
      auth: { uid: callerUid },
      data: { query: "test", limit: 5 },
    });

    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it("returns user with membership info", async () => {
    const userDocs = [
      makeUserDoc("user-1", {
        email: "teacher@school.com",
        displayName: "Teacher One",
        isSuperAdmin: false,
        activeTenantId: "tenant-1",
        lastLoginAt: null,
        createdAt: null,
      }),
    ];

    const membershipDocs = [
      {
        id: "mem-1",
        data: () => ({
          tenantId: "tenant-1",
          tenantCode: "SCH001",
          role: "teacher",
        }),
      },
    ];

    // Email search
    mockCollectionGet.mockResolvedValueOnce({ docs: userDocs });
    // displayName search (triggered because 1 < 20)
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    // Membership query
    mockCollectionGet.mockResolvedValueOnce({ docs: membershipDocs });

    const result = await handler({
      auth: { uid: callerUid },
      data: { query: "teacher" },
    });

    expect(result.users).toHaveLength(1);
    expect(result.users[0].memberships).toHaveLength(1);
    expect(result.users[0].memberships[0]).toEqual({
      tenantId: "tenant-1",
      tenantCode: "SCH001",
      role: "teacher",
    });
  });

  it("returns empty array when no users match", async () => {
    // Both searches return empty
    mockCollectionGet.mockResolvedValue({ docs: [] });

    const result = await handler({
      auth: { uid: callerUid },
      data: { query: "nonexistent" },
    });

    expect(result.users).toEqual([]);
  });

  it("respects pageLimit cap on merged results", async () => {
    // Create 3 email results with limit of 2
    const emailDocs = [
      makeUserDoc("user-1", { email: "a1@test.com", displayName: "A1" }),
      makeUserDoc("user-2", { email: "a2@test.com", displayName: "A2" }),
      makeUserDoc("user-3", { email: "a3@test.com", displayName: "A3" }),
    ];

    // Email search returns 3 docs (>= limit of 2, so no displayName search)
    mockCollectionGet.mockResolvedValueOnce({ docs: emailDocs });
    // Membership queries for the 2 users within limit
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });
    mockCollectionGet.mockResolvedValueOnce({ docs: [] });

    const result = await handler({
      auth: { uid: callerUid },
      data: { query: "a", limit: 2 },
    });

    expect(result.users.length).toBeLessThanOrEqual(2);
  });
});
