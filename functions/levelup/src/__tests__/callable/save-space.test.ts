/**
 * Unit tests for callable/save-space.ts
 * Mocks firebase-admin and utility modules to test the saveSpace handler logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Stable DB singleton — admin.firestore() always returns this same object.
// Declared at module scope so vi.mock factory (hoisted) can reference it.
// ---------------------------------------------------------------------------

const stableDb = {
  doc: vi.fn(),
  collection: vi.fn(),
  batch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  return { default: { firestore: fsFn }, firestore: fsFn };
});

vi.mock("firebase-functions/v2/https", async () => {
  const actual = await vi.importActual<any>("firebase-functions/v2/https");
  return { ...actual, onCall: vi.fn((_opts: any, handler: any) => handler) };
});

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/auth", () => ({
  assertAuth: vi.fn().mockReturnValue("caller-uid"),
  assertTeacherOrAdmin: vi.fn().mockResolvedValue({ role: "teacher", membership: {} }),
}));

vi.mock("../../utils/firestore", () => ({
  loadSpace: vi.fn(),
}));

vi.mock("../../utils/helpers", () => ({
  generateSlug: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, "-")),
}));

import { saveSpace } from "../../callable/save-space";
import { assertAuth, assertTeacherOrAdmin } from "../../utils/auth";
import { loadSpace } from "../../utils/firestore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callHandler(data: Record<string, any>, auth = { uid: "caller-uid" }) {
  return (saveSpace as any)({ data, auth });
}

const baseSpace = {
  title: "Existing Space",
  description: "A space",
  status: "draft",
  slug: "existing-space",
  type: "learning",
  subject: null,
  labels: [],
  classIds: [],
  thumbnailUrl: null,
  stats: { totalStoryPoints: 0, totalItems: 0, totalStudents: 0 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saveSpace", () => {
  let mockDocRef: any;
  let mockCollectionRef: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAuth).mockReturnValue("caller-uid");
    vi.mocked(assertTeacherOrAdmin).mockResolvedValue({ role: "teacher", membership: {} });

    mockDocRef = {
      id: "new-doc-id",
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
    };
    mockCollectionRef = { doc: vi.fn(() => mockDocRef) };

    // Configure the stable singleton for this test
    stableDb.doc.mockReturnValue(mockDocRef);
    stableDb.collection.mockReturnValue(mockCollectionRef);
    stableDb.batch.mockReturnValue({
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
  });

  // -------------------------------------------------------------------------
  // Auth & validation
  // -------------------------------------------------------------------------

  it("throws unauthenticated when caller has no auth", async () => {
    vi.mocked(assertAuth).mockImplementation(() => {
      throw new HttpsError("unauthenticated", "Must be logged in");
    });

    await expect(callHandler({ tenantId: "t1", data: {} }, undefined as any)).rejects.toThrow(
      "Must be logged in"
    );
  });

  // Schema-level validation message (wire schema rejects before the handler body).
  it("throws when tenantId is missing", async () => {
    await expect(callHandler({ tenantId: "", data: {} })).rejects.toThrow(
      "tenantId: ID cannot be empty"
    );
  });

  it("checks teacher/admin permission", async () => {
    vi.mocked(assertTeacherOrAdmin).mockRejectedValueOnce(
      new HttpsError("permission-denied", "Teacher or admin access required")
    );

    await expect(
      callHandler({ tenantId: "t1", data: { title: "X", type: "learning" } })
    ).rejects.toThrow("Teacher or admin access required");
  });

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("creates a space with required fields and returns id + created:true", async () => {
      const result = await callHandler({
        tenantId: "t1",
        data: { title: "My Space", type: "learning" },
      });

      expect(result).toEqual({ id: "new-doc-id", created: true });
      expect(mockDocRef.set).toHaveBeenCalledTimes(1);
      const setArg = mockDocRef.set.mock.calls[0][0];
      expect(setArg.title).toBe("My Space");
      expect(setArg.type).toBe("learning");
      expect(setArg.status).toBe("draft");
      expect(setArg.createdBy).toBe("caller-uid");
      expect(setArg.publishedToStore).toBe(false);
    });

    it("throws when title is missing on create", async () => {
      await expect(callHandler({ tenantId: "t1", data: { type: "learning" } })).rejects.toThrow(
        "title and type are required for creation"
      );
    });

    it("throws when type is missing on create", async () => {
      await expect(callHandler({ tenantId: "t1", data: { title: "X" } })).rejects.toThrow(
        "title and type are required for creation"
      );
    });

    it("defaults optional fields correctly", async () => {
      await callHandler({ tenantId: "t1", data: { title: "Test", type: "practice" } });

      const setArg = mockDocRef.set.mock.calls[0][0];
      expect(setArg.accessType).toBe("class_assigned");
      expect(setArg.allowRetakes).toBe(true);
      expect(setArg.maxRetakes).toBe(0);
      expect(setArg.showCorrectAnswers).toBe(true);
      expect(setArg.labels).toEqual([]);
      expect(setArg.classIds).toEqual([]);
      expect(setArg.description).toBeNull();
    });

    it("increments tenant stats after creation", async () => {
      await callHandler({ tenantId: "t1", data: { title: "X", type: "learning" } });

      expect(mockDocRef.update).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  describe("update", () => {
    it("updates allowed fields on an existing space", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace } as any);

      const result = await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { title: "Updated Title", description: "New desc" },
      });

      expect(result).toEqual({ id: "space-1", created: false });
      expect(mockDocRef.update).toHaveBeenCalled();
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.title).toBe("Updated Title");
      expect(updateArg.description).toBe("New desc");
    });

    it("throws when no valid fields to update", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace } as any);

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { unknownField: "something" },
        })
      ).rejects.toThrow("No valid fields to update");
    });
  });

  // -------------------------------------------------------------------------
  // Status transitions
  // -------------------------------------------------------------------------

  describe("status transitions", () => {
    it("allows draft -> published with valid publish data", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({
        ...baseSpace,
        status: "draft",
        title: "Valid",
      } as any);

      const spDoc = { id: "sp-1", data: () => ({ title: "SP1", type: "learning" }) };
      stableDb.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: false, docs: [spDoc] }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: false, docs: [{}] }),
          }),
        }),
      });

      const result = await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { status: "published" },
      });

      expect(result).toEqual({ id: "space-1", created: false });
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.status).toBe("published");
    });

    it("rejects draft -> archived (invalid transition)", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "draft" } as any);

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { status: "archived" },
        })
      ).rejects.toThrow("Cannot transition from 'draft' to 'archived'");
    });

    it("rejects archived -> published (invalid transition)", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "archived" } as any);

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { status: "published" },
        })
      ).rejects.toThrow("Cannot transition from 'archived' to 'published'");
    });

    it("allows published -> draft (unpublish/restore) and clears lifecycle timestamps", async () => {
      // The handler deliberately supports unpublish (ALLOWED_TRANSITIONS.published
      // includes 'draft' with a dedicated restore branch) — the old rejection
      // expectation predated that feature.
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      const result = await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { status: "draft" },
      });

      expect(result).toEqual({ id: "space-1", created: false });
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.status).toBe("draft");
      expect(updateArg.publishedAt).toBeNull();
      expect(updateArg.archivedAt).toBeNull();
    });

    it("allows published -> archived and expires active sessions", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      stableDb.collection.mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [], size: 0 }),
          }),
        }),
      });

      const result = await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { status: "archived" },
      });

      expect(result).toEqual({ id: "space-1", created: false });
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.status).toBe("archived");
    });

    it("batch-expires active sessions when archiving", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      const sessionDoc = { ref: { id: "session-1" } };
      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      stableDb.collection.mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: false, docs: [sessionDoc], size: 1 }),
          }),
        }),
      });
      stableDb.batch.mockReturnValue(mockBatch);

      await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { status: "archived" },
      });

      expect(mockBatch.update).toHaveBeenCalledWith(
        sessionDoc.ref,
        expect.objectContaining({ status: "expired", autoSubmitted: true })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("sets publishedAt timestamp on publish", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({
        ...baseSpace,
        status: "draft",
        title: "Valid",
      } as any);

      const spDoc = { id: "sp-1", data: () => ({ title: "SP1", type: "learning" }) };
      stableDb.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: false, docs: [spDoc] }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: false, docs: [{}] }),
          }),
        }),
      });

      await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { status: "published" },
      });

      const updateArg = mockDocRef.update.mock.calls[0][0];
      // B8: audit/lifecycle timestamps are canonical ISO strings.
      expect(updateArg.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  // -------------------------------------------------------------------------
  // Publish validation
  // -------------------------------------------------------------------------

  describe("publish validation", () => {
    it("rejects publish when space has no title", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({
        ...baseSpace,
        status: "draft",
        title: "",
      } as any);

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { status: "published" },
        })
      ).rejects.toThrow("Space must have a title");
    });

    it("rejects publish when space has no story points", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({
        ...baseSpace,
        status: "draft",
        title: "Valid",
      } as any);

      stableDb.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      });

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { status: "published" },
        })
      ).rejects.toThrow("Space must have at least one story point");
    });

    it("rejects publish when a story point has no items", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({
        ...baseSpace,
        status: "draft",
        title: "Valid",
      } as any);

      const spDoc = { id: "sp-1", data: () => ({ title: "Empty SP", type: "learning" }) };
      stableDb.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: false, docs: [spDoc] }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      });

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { status: "published" },
        })
      ).rejects.toThrow("must have at least one item");
    });

    it("rejects publish when timed_test story point has no duration", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({
        ...baseSpace,
        status: "draft",
        title: "Valid",
      } as any);

      const spDoc = {
        id: "sp-1",
        data: () => ({
          title: "Timed Test",
          type: "timed_test",
          assessmentConfig: { durationMinutes: 0 },
        }),
      };
      stableDb.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: false, docs: [spDoc] }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: false, docs: [{}] }),
          }),
        }),
      });

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { status: "published" },
        })
      ).rejects.toThrow("must have a duration > 0 minutes");
    });
  });

  // -------------------------------------------------------------------------
  // Store listing
  // -------------------------------------------------------------------------

  describe("store listing", () => {
    it("rejects publishedToStore when space is not published", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "draft" } as any);

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { publishedToStore: true, price: 10 },
        })
      ).rejects.toThrow("Space must be published before listing on the store");
    });

    it("rejects publishedToStore without a valid price", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { publishedToStore: true, price: -5 },
        })
      ).rejects.toThrow("price must be a non-negative number");
    });

    it("rejects publishedToStore when price is null", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      // null is rejected at the wire-schema layer (z.number().optional()).
      await expect(
        callHandler({
          id: "space-1",
          tenantId: "t1",
          data: { publishedToStore: true, price: null },
        })
      ).rejects.toThrow("Invalid request: data.price");
    });

    it("defaults currency to USD when not specified", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { publishedToStore: true, price: 10 },
      });

      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.currency).toBe("USD");
    });

    it("writes store listing and sets publishedToStore on the source space", async () => {
      vi.mocked(loadSpace).mockResolvedValueOnce({ ...baseSpace, status: "published" } as any);

      const result = await callHandler({
        id: "space-1",
        tenantId: "t1",
        data: { publishedToStore: true, price: 0, currency: "INR" },
      });

      expect(result).toEqual({ id: "space-1", created: false });
      expect(mockDocRef.set).toHaveBeenCalled();
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.publishedToStore).toBe(true);
      expect(updateArg.currency).toBe("INR");
    });
  });
});
