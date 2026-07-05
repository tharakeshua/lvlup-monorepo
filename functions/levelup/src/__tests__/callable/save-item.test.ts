/**
 * Unit tests for callable/save-item.ts
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
  batch: vi.fn(() => ({
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
  assertTeacherOrAdmin: vi.fn().mockResolvedValue({ role: "teacher" }),
}));

vi.mock("../../utils/firestore", () => ({
  loadSpace: vi.fn().mockResolvedValue({ id: "space-1", status: "draft" }),
  loadStoryPoint: vi.fn().mockResolvedValue({ id: "sp-1", type: "learn" }),
  loadItem: vi.fn(),
}));

vi.mock("../../callable/create-item", () => ({
  extractAnswerKey: vi.fn().mockReturnValue(null),
  stripAnswerFromPayload: vi.fn((p: any) => p),
}));

import { saveItem } from "../../callable/save-item";
import { loadSpace, loadStoryPoint, loadItem } from "../../utils/firestore";
import { extractAnswerKey, stripAnswerFromPayload } from "../../callable/create-item";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callHandler(data: Record<string, any>, auth = { uid: "caller-uid" }) {
  return (saveItem as any)({ data, auth });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saveItem", () => {
  let mockDocRef: any;
  let mockItemRef: any;
  let mockAkRef: any;
  let mockBatch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSpace).mockResolvedValue({ id: "space-1", status: "draft" } as any);
    vi.mocked(loadStoryPoint).mockResolvedValue({ id: "sp-1", type: "learn" } as any);
    vi.mocked(extractAnswerKey).mockReturnValue(null);
    vi.mocked(stripAnswerFromPayload).mockImplementation((p: any) => p);

    mockDocRef = {
      get: vi.fn().mockResolvedValue({ exists: true }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    mockItemRef = { id: "new-item-id", set: vi.fn().mockResolvedValue(undefined) };
    mockAkRef = { id: "ak-1", set: vi.fn().mockResolvedValue(undefined) };
    mockBatch = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };

    stableDb.doc.mockReturnValue(mockDocRef);
    stableDb.batch.mockReturnValue(mockBatch);
    stableDb.collection.mockImplementation((path: string) => {
      if (path.includes("/answerKeys")) {
        return {
          doc: vi.fn(() => mockAkRef),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        };
      }
      return {
        doc: vi.fn(() => mockItemRef),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };
    });
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  // Schema-level validation messages (wire schema rejects before the handler body).
  it("throws when tenantId is missing", async () => {
    await expect(
      callHandler({
        tenantId: "",
        spaceId: "s1",
        storyPointId: "sp1",
        data: {},
      })
    ).rejects.toThrow("tenantId: ID cannot be empty");
  });

  it("throws when spaceId is missing", async () => {
    await expect(
      callHandler({
        tenantId: "t1",
        spaceId: "",
        storyPointId: "sp1",
        data: {},
      })
    ).rejects.toThrow("spaceId: ID cannot be empty");
  });

  it("throws when storyPointId is missing", async () => {
    await expect(
      callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "",
        data: {},
      })
    ).rejects.toThrow("storyPointId: ID cannot be empty");
  });

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("creates a question item with required fields", async () => {
      const result = await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: {
          type: "question",
          payload: { questionType: "mcq", questionData: { text: "What is 2+2?" } },
        },
      });

      expect(result).toEqual({ id: "new-item-id", created: true });
      expect(mockItemRef.set).toHaveBeenCalled();
      const setArg = mockItemRef.set.mock.calls[0][0];
      expect(setArg.type).toBe("question");
      expect(setArg.storyPointId).toBe("sp-1");
      expect(setArg.createdBy).toBe("caller-uid");
    });

    it("creates a material item", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: {
          type: "material",
          payload: { content: "Some educational content" },
          title: "Lesson 1",
        },
      });

      const setArg = mockItemRef.set.mock.calls[0][0];
      expect(setArg.type).toBe("material");
      expect(setArg.title).toBe("Lesson 1");
    });

    it("throws when type is missing on create", async () => {
      await expect(
        callHandler({
          tenantId: "t1",
          spaceId: "s1",
          storyPointId: "sp-1",
          data: { payload: { text: "hello" } },
        })
      ).rejects.toThrow("type and payload are required for creation");
    });

    it("throws when payload is missing on create", async () => {
      await expect(
        callHandler({
          tenantId: "t1",
          spaceId: "s1",
          storyPointId: "sp-1",
          data: { type: "question" },
        })
      ).rejects.toThrow("type and payload are required for creation");
    });

    it("auto-assigns orderIndex 0 for first item", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { type: "question", payload: { questionType: "text" } },
      });

      const setArg = mockItemRef.set.mock.calls[0][0];
      expect(setArg.orderIndex).toBe(0);
    });

    it("defaults optional fields correctly", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { type: "question", payload: { questionType: "text" } },
      });

      const setArg = mockItemRef.set.mock.calls[0][0];
      expect(setArg.title).toBeNull();
      expect(setArg.content).toBeNull();
      expect(setArg.difficulty).toBeNull();
      expect(setArg.topics).toEqual([]);
      expect(setArg.labels).toEqual([]);
      expect(setArg.analytics).toBeNull();
    });

    it("extracts answer key for timed_test question items", async () => {
      vi.mocked(loadStoryPoint).mockResolvedValue({ id: "sp-1", type: "timed_test" } as any);
      vi.mocked(extractAnswerKey).mockReturnValueOnce({ correctAnswer: ["opt-1"] });
      vi.mocked(stripAnswerFromPayload).mockReturnValueOnce({
        questionType: "mcq",
        questionData: {},
      });

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: {
          type: "question",
          payload: {
            questionType: "mcq",
            questionData: { options: [{ id: "opt-1", isCorrect: true }] },
          },
        },
      });

      expect(extractAnswerKey).toHaveBeenCalled();
      expect(stripAnswerFromPayload).toHaveBeenCalled();
      expect(mockAkRef.set).toHaveBeenCalled();
    });

    it("does not extract answer key for learn storyPoint type", async () => {
      vi.mocked(loadStoryPoint).mockResolvedValue({ id: "sp-1", type: "learn" } as any);

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { type: "question", payload: { questionType: "mcq", questionData: {} } },
      });

      expect(extractAnswerKey).not.toHaveBeenCalled();
    });

    it("does not extract answer key for material items in timed_test", async () => {
      vi.mocked(loadStoryPoint).mockResolvedValue({ id: "sp-1", type: "timed_test" } as any);

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { type: "material", payload: { content: "text" } },
      });

      expect(extractAnswerKey).not.toHaveBeenCalled();
    });

    it("extracts answer key for test storyPoint type (not just timed_test)", async () => {
      vi.mocked(loadStoryPoint).mockResolvedValue({ id: "sp-1", type: "test" } as any);
      vi.mocked(extractAnswerKey).mockReturnValueOnce({ correctAnswer: ["b"] });
      vi.mocked(stripAnswerFromPayload).mockReturnValueOnce({
        questionType: "mcq",
        questionData: {},
      });

      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: {
          type: "question",
          payload: { questionType: "mcq", questionData: { text: "Q?" } },
        },
      });

      expect(extractAnswerKey).toHaveBeenCalled();
      expect(mockAkRef.set).toHaveBeenCalled();
    });

    it("increments totalQuestions stat for question items", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: {
          type: "question",
          payload: { questionType: "text" },
          meta: { totalPoints: 10 },
        },
      });

      // storyPoint stats update (second update call after space stats)
      expect(mockDocRef.update).toHaveBeenCalled();
    });

    it("increments totalMaterials stat for material items", async () => {
      await callHandler({
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { type: "material", payload: { content: "text" } },
      });

      expect(mockDocRef.update).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------

  describe("delete", () => {
    it("deletes a question item and updates stats", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({
        id: "item-1",
        type: "question",
        storyPointId: "sp-1",
        meta: { totalPoints: 5 },
      } as any);

      const result = await callHandler({
        id: "item-1",
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { deleted: true },
      });

      expect(result).toEqual({ id: "item-1", created: false });
      expect(mockDocRef.delete).toHaveBeenCalled();
    });

    it("batch-deletes answer keys subcollection before deleting item", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({
        id: "item-1",
        type: "question",
        storyPointId: "sp-1",
        meta: null,
      } as any);

      const akRef = { ref: "ak-ref" };
      stableDb.collection.mockImplementation((path: string) => {
        if (path.includes("/answerKeys")) {
          return { get: vi.fn().mockResolvedValue({ empty: false, docs: [akRef] }) };
        }
        return { get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) };
      });

      await callHandler({
        id: "item-1",
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { deleted: true },
      });

      expect(mockBatch.delete).toHaveBeenCalledWith("ak-ref");
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("deletes a material item and decrements totalMaterials", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({
        id: "item-1",
        type: "material",
        storyPointId: "sp-1",
        meta: null,
      } as any);

      await callHandler({
        id: "item-1",
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { deleted: true },
      });

      expect(mockDocRef.delete).toHaveBeenCalled();
      expect(mockDocRef.update).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  describe("update", () => {
    it("updates allowed fields on an existing item", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({
        id: "item-1",
        type: "question",
        payload: {},
      } as any);

      const result = await callHandler({
        id: "item-1",
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { title: "New Title", difficulty: "hard" },
      });

      expect(result).toEqual({ id: "item-1", created: false });
      const updateArg = mockDocRef.update.mock.calls[0][0];
      expect(updateArg.title).toBe("New Title");
      expect(updateArg.difficulty).toBe("hard");
    });

    it("throws when no valid fields to update", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({ id: "item-1" } as any);

      await expect(
        callHandler({
          id: "item-1",
          tenantId: "t1",
          spaceId: "s1",
          storyPointId: "sp-1",
          data: { unknownField: "x" },
        })
      ).rejects.toThrow("No valid fields to update");
    });

    it("updates answer key when payload changes on a timed test item", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({
        id: "item-1",
        type: "question",
        payload: {},
      } as any);
      vi.mocked(extractAnswerKey).mockReturnValueOnce({ correctAnswer: ["a"] });
      vi.mocked(stripAnswerFromPayload).mockReturnValueOnce({
        questionType: "mcq",
        questionData: {},
      });

      const akDoc = { ref: { update: vi.fn().mockResolvedValue(undefined) } };
      stableDb.collection.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: false, docs: [akDoc] }),
        }),
      });

      await callHandler({
        id: "item-1",
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { payload: { questionType: "mcq", questionData: {} } },
      });

      expect(extractAnswerKey).toHaveBeenCalled();
      expect(akDoc.ref.update).toHaveBeenCalled();
    });

    it("skips answer key update when no answerKeys subcollection exists", async () => {
      vi.mocked(loadItem).mockResolvedValueOnce({
        id: "item-1",
        type: "question",
        payload: {},
      } as any);

      stableDb.collection.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      });

      await callHandler({
        id: "item-1",
        tenantId: "t1",
        spaceId: "s1",
        storyPointId: "sp-1",
        data: { payload: { questionType: "text", questionData: {} } },
      });

      // extractAnswerKey should NOT be called since no AK doc exists
      expect(extractAnswerKey).not.toHaveBeenCalled();
    });
  });
});
