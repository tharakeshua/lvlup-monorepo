import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockAssertAuth = vi.fn();
const mockAssertTeacherOrAdmin = vi.fn();
vi.mock("../../utils/auth", () => ({
  assertAuth: (...args: unknown[]) => mockAssertAuth(...args),
  assertTeacherOrAdmin: (...args: unknown[]) => mockAssertTeacherOrAdmin(...args),
}));

const mockEnforceRateLimit = vi.fn();
vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

// Firestore chain mocks
const mockStartAfter = vi.fn().mockReturnThis();
const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockCollectionRef = vi.fn();
const mockDocGet = vi.fn();
const mockDocRef = vi.fn();

vi.mock("firebase-admin", () => ({
  default: {
    firestore: vi.fn(() => ({
      collection: mockCollectionRef,
      doc: mockDocRef,
    })),
  },
  firestore: vi.fn(() => ({
    collection: mockCollectionRef,
    doc: mockDocRef,
  })),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_opts: unknown, handler: Function) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

import { listVersions } from "../../callable/list-versions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeVersionDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      version: 1,
      entityType: "item",
      entityId: "item-1",
      changeType: "updated",
      changeSummary: "Updated content",
      changedBy: "user-1",
      changedAt: { seconds: 1700000000, nanoseconds: 0 },
      ...overrides,
    }),
  };
}

function setupQuery(docs: ReturnType<typeof makeVersionDoc>[]) {
  const chainable = {
    where: mockWhere.mockReturnThis(),
    orderBy: mockOrderBy.mockReturnThis(),
    startAfter: mockStartAfter.mockReturnThis(),
    limit: mockLimit.mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs }),
    }),
  };

  mockCollectionRef.mockReturnValue(chainable);
  // Also make where/orderBy return the chainable so chaining works
  mockWhere.mockReturnValue(chainable);
  mockOrderBy.mockReturnValue(chainable);
  mockStartAfter.mockReturnValue(chainable);
  mockLimit.mockReturnValue({
    get: vi.fn().mockResolvedValue({ docs }),
  });
}

function callListVersions(data: Record<string, unknown>, auth?: { uid: string }) {
  const handler = listVersions as unknown as Function;
  return handler({
    data,
    auth: auth ?? { uid: "user-1" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("list-versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAuth.mockReturnValue("user-1");
    mockAssertTeacherOrAdmin.mockResolvedValue({ role: "teacher" });
    mockEnforceRateLimit.mockResolvedValue(undefined);
    setupQuery([]);
  });

  // ── Auth ──────────────────────────────────────────────────────────
  it("throws unauthenticated when auth is missing", async () => {
    mockAssertAuth.mockImplementation(() => {
      throw new Error("Must be logged in");
    });

    await expect(callListVersions({ tenantId: "t1", spaceId: "s1" }, undefined)).rejects.toThrow(
      "Must be logged in"
    );
  });

  it("throws when caller is not teacher or admin", async () => {
    mockAssertTeacherOrAdmin.mockRejectedValue(new Error("Teacher or admin access required"));

    await expect(callListVersions({ tenantId: "t1", spaceId: "s1" })).rejects.toThrow(
      "Teacher or admin access required"
    );
  });

  // ── Success paths ─────────────────────────────────────────────────
  it("returns versions list", async () => {
    const docs = [makeVersionDoc("v1"), makeVersionDoc("v2")];
    setupQuery(docs);

    const result = await callListVersions({ tenantId: "t1", spaceId: "s1" });

    expect(result.versions).toHaveLength(2);
    expect(result.versions[0].id).toBe("v1");
    expect(result.versions[1].id).toBe("v2");
    expect(result.hasMore).toBe(false);
    // B8 round-trip: Firestore Timestamp at rest → canonical ISO out.
    expect(result.versions[0].changedAt).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("applies entityType filter", async () => {
    setupQuery([makeVersionDoc("v1", { entityType: "item" })]);

    await callListVersions({
      tenantId: "t1",
      spaceId: "s1",
      entityType: "item",
    });

    expect(mockWhere).toHaveBeenCalledWith("entityType", "==", "item");
  });

  it("applies entityId filter", async () => {
    setupQuery([makeVersionDoc("v1")]);

    await callListVersions({
      tenantId: "t1",
      spaceId: "s1",
      entityId: "item-42",
    });

    expect(mockWhere).toHaveBeenCalledWith("entityId", "==", "item-42");
  });

  it("uses cursor pagination via startAfter", async () => {
    const cursorDoc = { exists: true };
    mockDocRef.mockReturnValue({ get: vi.fn().mockResolvedValue(cursorDoc) });
    setupQuery([makeVersionDoc("v2")]);

    await callListVersions({
      tenantId: "t1",
      spaceId: "s1",
      startAfter: "v1",
    });

    expect(mockDocRef).toHaveBeenCalled();
    expect(mockStartAfter).toHaveBeenCalledWith(cursorDoc);
  });

  it("detects hasMore when docs exceed limit", async () => {
    // Default limit is 20; provide 21 docs to trigger hasMore
    const docs = Array.from({ length: 21 }, (_, i) => makeVersionDoc(`v${i}`));
    setupQuery(docs);

    const result = await callListVersions({ tenantId: "t1", spaceId: "s1" });

    expect(result.hasMore).toBe(true);
    expect(result.versions).toHaveLength(20);
  });

  it("uses default limit of 20", async () => {
    setupQuery([]);

    await callListVersions({ tenantId: "t1", spaceId: "s1" });

    // limit is called with queryLimit + 1 = 21
    expect(mockLimit).toHaveBeenCalledWith(21);
  });

  it("uses custom limit", async () => {
    setupQuery([]);

    await callListVersions({ tenantId: "t1", spaceId: "s1", limit: 5 });

    // limit is called with queryLimit + 1 = 6
    expect(mockLimit).toHaveBeenCalledWith(6);
  });

  it("returns lastId as null when result is empty", async () => {
    setupQuery([]);

    const result = await callListVersions({ tenantId: "t1", spaceId: "s1" });

    expect(result.lastId).toBeNull();
    expect(result.versions).toHaveLength(0);
  });

  it("returns lastId as id of last doc", async () => {
    setupQuery([makeVersionDoc("v1"), makeVersionDoc("v2")]);

    const result = await callListVersions({ tenantId: "t1", spaceId: "s1" });

    expect(result.lastId).toBe("v2");
  });
});
