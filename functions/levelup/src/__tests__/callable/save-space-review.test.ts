/**
 * Unit tests for callable/save-space-review.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockCollectionGet = vi.fn();

const stableDb: any = {
  doc: vi.fn(() => ({
    get: mockDocGet,
    set: mockDocSet,
    update: mockDocUpdate,
  })),
  collection: vi.fn(() => ({
    get: mockCollectionGet,
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  return {
    default: { firestore: fsFn },
    firestore: fsFn,
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

vi.mock("../../utils/auth", () => ({
  assertAuth: vi.fn().mockReturnValue("user-1"),
  assertTenantMember: vi.fn().mockResolvedValue({ role: "student" }),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

import { saveSpaceReview } from "../../callable/save-space-review";
import { assertAuth } from "../../utils/auth";

const handler = saveSpaceReview as any;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "user-1" }),
    rawRequest: {} as any,
  };
}

/**
 * Sets up the sequence of doc.get() calls expected by the handler:
 * 1. spaceRef.get() - space exists check
 * 2. reviewRef.get() - existing review check
 * 3. userDoc.get() - user display name
 */
function setupDocGets(opts: {
  spaceExists?: boolean;
  existingReview?: boolean;
  existingReviewData?: Record<string, unknown>;
  userName?: string;
}) {
  const {
    spaceExists = true,
    existingReview = false,
    existingReviewData = {},
    userName = "Test User",
  } = opts;

  // 1. spaceRef.get()
  mockDocGet.mockResolvedValueOnce({
    exists: spaceExists,
    data: () => ({}),
  });

  // 2. reviewRef.get()
  mockDocGet.mockResolvedValueOnce({
    exists: existingReview,
    data: () => existingReviewData,
  });

  // 3. userDoc.get()
  mockDocGet.mockResolvedValueOnce({
    exists: true,
    data: () => ({ displayName: userName }),
  });
}

/**
 * Set up the aggregate collection response (all reviews for recomputation).
 */
function setupReviewsCollection(reviews: { rating: number }[]) {
  mockCollectionGet.mockResolvedValueOnce({
    docs: reviews.map((r, i) => ({
      id: `review-${i}`,
      data: () => ({ rating: r.rating }),
    })),
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("saveSpaceReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAuth).mockReturnValue("user-1");
  });

  // ───────────────────── Auth / Validation ─────────────────────

  it("rejects unauthenticated request", async () => {
    vi.mocked(assertAuth).mockImplementation(() => {
      const err = new Error("Must be logged in") as any;
      err.code = "unauthenticated";
      throw err;
    });

    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: 4 }, null))
    ).rejects.toThrow("Must be logged in");
  });

  // Schema-level validation messages (wire schema rejects before the handler body).
  it("rejects when tenantId is missing", async () => {
    await expect(handler(makeRequest({ spaceId: "space-1", rating: 4 }))).rejects.toThrow(
      "Invalid request: tenantId"
    );
  });

  it("rejects when spaceId is missing", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1", rating: 4 }))).rejects.toThrow(
      "Invalid request: spaceId"
    );
  });

  // ───────────────────── Rating validation ─────────────────────

  it("rejects rating less than 1", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: 0 }))
    ).rejects.toThrow("Invalid request: rating");
  });

  it("rejects rating greater than 5", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: 6 }))
    ).rejects.toThrow("Invalid request: rating");
  });

  it("rejects non-integer rating (decimal)", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: 3.5 }))
    ).rejects.toThrow("Invalid request: rating");
  });

  it("rejects negative rating", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: -1 }))
    ).rejects.toThrow("Invalid request: rating");
  });

  it("rejects NaN rating", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: NaN }))
    ).rejects.toThrow("Invalid request: rating");
  });

  // ───────────────────── Space not found ─────────────────────

  it("rejects when space does not exist", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });

    await expect(
      handler(makeRequest({ tenantId: "tenant-1", spaceId: "space-1", rating: 4 }))
    ).rejects.toThrow("Space not found");
  });

  // ───────────────────── Create new review ─────────────────────

  it("creates a new review with correct fields", async () => {
    setupDocGets({ existingReview: false, userName: "Alice" });
    setupReviewsCollection([{ rating: 4 }]); // The single new review

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 4,
        comment: "  Great course!  ",
      })
    );

    expect(result).toEqual({ success: true, isUpdate: false });

    // Verify review was saved via set with merge
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        spaceId: "space-1",
        tenantId: "tenant-1",
        userId: "user-1",
        userName: "Alice",
        rating: 4,
        comment: "Great course!", // trimmed
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // new review gets createdAt
      }),
      { merge: true }
    );

    // Verify correct doc paths
    expect(stableDb.doc).toHaveBeenCalledWith("tenants/tenant-1/spaces/space-1/reviews/user-1");
    expect(stableDb.doc).toHaveBeenCalledWith("tenants/tenant-1/spaces/space-1");
  });

  it("sets comment to null when empty string", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 3 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 3,
        comment: "   ",
      })
    );

    expect(mockDocSet).toHaveBeenCalledWith(expect.objectContaining({ comment: null }), {
      merge: true,
    });
  });

  it("sets comment to null when not provided", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 5 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 5,
      })
    );

    expect(mockDocSet).toHaveBeenCalledWith(expect.objectContaining({ comment: null }), {
      merge: true,
    });
  });

  it('uses "Anonymous" when user document does not exist', async () => {
    // 1. space exists
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
    // 2. review does not exist
    mockDocGet.mockResolvedValueOnce({ exists: false });
    // 3. user doc does not exist
    mockDocGet.mockResolvedValueOnce({ exists: false });

    setupReviewsCollection([{ rating: 4 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 4,
      })
    );

    expect(mockDocSet).toHaveBeenCalledWith(expect.objectContaining({ userName: "Anonymous" }), {
      merge: true,
    });
  });

  // ───────────────────── Update existing review ─────────────────────

  it("updates an existing review (isUpdate: true)", async () => {
    setupDocGets({ existingReview: true, userName: "Bob" });
    setupReviewsCollection([{ rating: 5 }]);

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 5,
        comment: "Updated review",
      })
    );

    expect(result).toEqual({ success: true, isUpdate: true });

    // Update should NOT include createdAt
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.not.objectContaining({ createdAt: expect.anything() }),
      { merge: true }
    );

    // Should still have updatedAt
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }),
      { merge: true }
    );
  });

  // ───────────────────── Aggregate recomputation ─────────────────────

  it("recomputes aggregate correctly after new review", async () => {
    setupDocGets({ existingReview: false });

    // All reviews in the collection after save
    setupReviewsCollection([{ rating: 5 }, { rating: 4 }, { rating: 3 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 3,
      })
    );

    // Average: (5+4+3)/3 = 4.0, totalReviews: 3
    expect(mockDocUpdate).toHaveBeenCalledWith({
      ratingAggregate: {
        averageRating: 4,
        totalReviews: 3,
        distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
      },
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("recomputes aggregate correctly after update", async () => {
    setupDocGets({ existingReview: true });

    // After update, all reviews
    setupReviewsCollection([
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 4 },
      { rating: 1 },
    ]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 4,
      })
    );

    // Average: (5+5+4+4+1)/5 = 3.8, totalReviews: 5
    expect(mockDocUpdate).toHaveBeenCalledWith({
      ratingAggregate: {
        averageRating: 3.8,
        totalReviews: 5,
        distribution: { 1: 1, 2: 0, 3: 0, 4: 2, 5: 2 },
      },
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("computes averageRating rounded to one decimal place", async () => {
    setupDocGets({ existingReview: false });

    // (5+4+4) / 3 = 4.333... => rounds to 4.3
    setupReviewsCollection([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 4,
      })
    );

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ratingAggregate: expect.objectContaining({
          averageRating: 4.3,
        }),
      })
    );
  });

  it("handles single review aggregate correctly", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 5 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 5,
      })
    );

    expect(mockDocUpdate).toHaveBeenCalledWith({
      ratingAggregate: {
        averageRating: 5,
        totalReviews: 1,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
      },
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("builds correct rating distribution", async () => {
    setupDocGets({ existingReview: false });

    // Two 5s, one 4, one 2, one 1
    setupReviewsCollection([
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 2 },
      { rating: 1 },
    ]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 1,
      })
    );

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ratingAggregate: expect.objectContaining({
          distribution: { 1: 1, 2: 1, 3: 0, 4: 1, 5: 2 },
        }),
      })
    );
  });

  it("skips reviews with invalid ratings during aggregate", async () => {
    setupDocGets({ existingReview: false });

    // Include some out-of-range ratings
    setupReviewsCollection([
      { rating: 5 },
      { rating: 0 }, // invalid, skipped
      { rating: 6 }, // invalid, skipped
      { rating: 3 },
    ]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 3,
      })
    );

    // Only 5 and 3 are valid: average = (5+3)/2 = 4.0
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ratingAggregate: expect.objectContaining({
          averageRating: 4,
          totalReviews: 2,
        }),
      })
    );
  });

  // ───────────────────── Edge cases ─────────────────────

  it("accepts rating of exactly 1", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 1 }]);

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 1,
      })
    );

    expect(result).toEqual({ success: true, isUpdate: false });
  });

  it("accepts rating of exactly 5", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 5 }]);

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 5,
      })
    );

    expect(result).toEqual({ success: true, isUpdate: false });
  });

  it("fetches the correct review doc path (one review per user per space)", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 4 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 4,
      })
    );

    // Review doc path: tenants/{tenantId}/spaces/{spaceId}/reviews/{userId}
    expect(stableDb.doc).toHaveBeenCalledWith("tenants/tenant-1/spaces/space-1/reviews/user-1");
  });

  it("reads all reviews from the correct collection path", async () => {
    setupDocGets({ existingReview: false });
    setupReviewsCollection([{ rating: 4 }]);

    await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        rating: 4,
      })
    );

    expect(stableDb.collection).toHaveBeenCalledWith("tenants/tenant-1/spaces/space-1/reviews");
  });
});
