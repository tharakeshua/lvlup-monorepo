/**
 * Unit tests for callable/save-story-point.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Stable DB singleton — admin.firestore() always returns this same object.
// ---------------------------------------------------------------------------

const stableDb = {
  doc: vi.fn(),
  collection: vi.fn(),
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
  assertTeacherOrAdmin: vi.fn().mockResolvedValue({ role: "teacher" }),
}));

vi.mock("../../utils/firestore", () => ({
  loadSpace: vi.fn().mockResolvedValue({ id: "space-1", status: "draft" }),
  loadStoryPoint: vi.fn(),
}));

import { saveStoryPoint } from "../../callable/save-story-point";
import { assertAuth } from "../../utils/auth";
import { loadSpace, loadStoryPoint } from "../../utils/firestore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callHandler(data: Record<string, any>, auth = { uid: "caller-uid" }) {
  return (saveStoryPoint as any)({ data, auth });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saveStoryPoint", () => {
  let mockDocRef: any;
  let mockSpRef: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAuth).mockReturnValue("caller-uid");
    vi.mocked(loadSpace).mockResolvedValue({ id: "space-1", status: "draft" } as any);

    mockDocRef = { update: vi.fn().mockResolvedValue(undefined) };
    mockSpRef = { id: "new-sp-id", set: vi.fn().mockResolvedValue(undefined) };

    stableDb.doc.mockReturnValue(mockDocRef);
    stableDb.collection.mockReturnValue({
      doc: vi.fn(() => mockSpRef),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    });
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  // Schema-level validation messages (wire schema rejects before the handler body).
  it("throws when tenantId is missing", async () => {
    await expect(callHandler({ tenantId: "", spaceId: "s1", data: {} })).rejects.toThrow(
      "tenantId: ID cannot be empty"
    );
  });

  it("throws when spaceId is missing", async () => {
    await expect(callHandler({ tenantId: "t1", spaceId: "", data: {} })).rejects.toThrow(
      "spaceId: ID cannot be empty"
    );
  });

  it("verifies the parent space exists", async () => {
    vi.mocked(loadSpace).mockRejectedValueOnce(
      new HttpsError("not-found", "Space not-found not found")
    );

    await expect(
      callHandler({
        tenantId: "t1",
        spaceId: "bad-space",
        data: { title: "X", type: "standard" },
      })
    ).rejects.toThrow("not found");
  });

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("creates a story point with required fields", async () => {
      const result = await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "Chapter 1", type: "standard" },
      });

      expect(result).toEqual({ id: "new-sp-id", created: true });
      expect(mockSpRef.set).toHaveBeenCalledTimes(1);
      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.title).toBe("Chapter 1");
      expect(setArg.type).toBe("standard");
      expect(setArg.createdBy).toBe("caller-uid");
    });

    it("throws when title is missing on create", async () => {
      await expect(
        callHandler({
          tenantId: "t1",
          spaceId: "s1",
          data: { type: "standard" },
        })
      ).rejects.toThrow("title and type are required for creation");
    });

    it("throws when type is missing on create", async () => {
      await expect(
        callHandler({
          tenantId: "t1",
          spaceId: "s1",
          data: { title: "X" },
        })
      ).rejects.toThrow("title and type are required for creation");
    });

    it("auto-assigns orderIndex 0 when no existing story points", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "First", type: "standard" },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.orderIndex).toBe(0);
    });

    it("auto-assigns next orderIndex based on existing story points", async () => {
      stableDb.collection.mockReturnValue({
        doc: vi.fn(() => mockSpRef),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ data: () => ({ orderIndex: 3 }) }],
            }),
          }),
        }),
      });

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "Next", type: "standard" },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.orderIndex).toBe(4);
    });

    it("uses explicit orderIndex when provided", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "X", type: "standard", orderIndex: 10 },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.orderIndex).toBe(10);
    });

    it("defaults optional fields correctly", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "X", type: "quiz" },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.description).toBeNull();
      expect(setArg.sections).toEqual([]);
      expect(setArg.assessmentConfig).toBeNull();
      expect(setArg.difficulty).toBeNull();
      expect(setArg.stats).toEqual({
        totalItems: 0,
        totalQuestions: 0,
        totalMaterials: 0,
        totalPoints: 0,
      });
    });

    it("creates with sections data when provided", async () => {
      const sections = [
        { id: "sec-1", title: "Algebra", orderIndex: 0 },
        { id: "sec-2", title: "Geometry", orderIndex: 1 },
      ];

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "Math", type: "test", sections },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.sections).toEqual(sections);
    });

    it("increments space totalStoryPoints after creation", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "X", type: "standard" },
      });

      expect(mockDocRef.update).toHaveBeenCalled();
    });

    it("passes assessmentConfig when provided", async () => {
      const assessmentConfig = { durationMinutes: 30, maxAttempts: 2 };

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "Test SP", type: "timed_test", assessmentConfig },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.assessmentConfig).toEqual(assessmentConfig);
    });

    it("defaults estimatedTimeMinutes to null", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "X", type: "standard" },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.estimatedTimeMinutes).toBeNull();
    });

    it("sets spaceId and tenantId on the created doc", async () => {
      await callHandler({
        tenantId: "my-tenant",
        spaceId: "my-space",
        data: { title: "X", type: "standard" },
      });

      const setArg = mockSpRef.set.mock.calls[0][0];
      expect(setArg.spaceId).toBe("my-space");
      expect(setArg.tenantId).toBe("my-tenant");
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  describe("update", () => {
    it("updates allowed fields on an existing story point", async () => {
      vi.mocked(loadStoryPoint).mockResolvedValueOnce({
        id: "sp-1",
        title: "Old",
        type: "standard",
      } as any);

      const result = await callHandler({
        id: "sp-1",
        tenantId: "t1",
        spaceId: "s1",
        data: { title: "New Title", description: "Updated" },
      });

      expect(result).toEqual({ id: "sp-1", created: false });
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.title).toBe("New Title");
      expect(updateArg.description).toBe("Updated");
    });

    it("throws when no valid fields to update", async () => {
      vi.mocked(loadStoryPoint).mockResolvedValueOnce({ id: "sp-1" } as any);

      await expect(
        callHandler({
          id: "sp-1",
          tenantId: "t1",
          spaceId: "s1",
          data: { invalidField: "value" },
        })
      ).rejects.toThrow("No valid fields to update");
    });

    it("throws when story point does not exist", async () => {
      vi.mocked(loadStoryPoint).mockRejectedValueOnce(
        new HttpsError("not-found", "StoryPoint sp-bad not found")
      );

      await expect(
        callHandler({
          id: "sp-bad",
          tenantId: "t1",
          spaceId: "s1",
          data: { title: "X" },
        })
      ).rejects.toThrow("not found");
    });
  });
});
