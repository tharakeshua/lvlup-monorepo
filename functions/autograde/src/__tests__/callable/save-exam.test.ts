import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockSet,
  mockUpdate,
  mockGet,
  mockBatchUpdate,
  mockBatchCommit,
  mockDocRef,
  mockCollectionRef,
  mockWhere,
  mockLimit,
  fakeServerTimestamp,
  fakeIncrement,
  mockGetExam,
  mockGetExamQuestions,
} = vi.hoisted(() => ({
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockGet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
  mockDocRef: vi.fn(),
  mockCollectionRef: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  fakeServerTimestamp: { _type: "serverTimestamp" },
  fakeIncrement: (n: number) => ({ _type: "increment", value: n }),
  mockGetExam: vi.fn(),
  mockGetExamQuestions: vi.fn(),
}));

vi.mock("firebase-admin", () => {
  const docFn = (...args: any[]) => {
    mockDocRef(...args);
    return {
      id: "new-exam-id",
      set: mockSet,
      update: mockUpdate,
      get: mockGet,
    };
  };

  const colFn = (...args: any[]) => {
    mockCollectionRef(...args);
    return {
      doc: docFn,
      where: (...wArgs: any[]) => {
        mockWhere(...wArgs);
        return {
          where: (...w2: any[]) => {
            mockWhere(...w2);
            return {
              get: mockGet,
              limit: (...l: any[]) => {
                mockLimit(...l);
                return { get: mockGet };
              },
            };
          },
          get: mockGet,
          limit: (...l: any[]) => {
            mockLimit(...l);
            return { get: mockGet };
          },
        };
      },
    };
  };

  const firestoreFn: any = () => ({
    collection: colFn,
    doc: docFn,
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
    runTransaction: vi.fn(),
  });

  firestoreFn.FieldValue = {
    serverTimestamp: () => fakeServerTimestamp,
    increment: fakeIncrement,
    delete: () => ({ _type: "delete" }),
  };
  firestoreFn.Timestamp = {
    fromDate: (d: Date) => ({ _type: "timestamp", value: d.toISOString() }),
  };

  return {
    default: {
      initializeApp: vi.fn(),
      firestore: firestoreFn,
    },
    firestore: firestoreFn,
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: Function) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("../../utils/assertions", () => ({
  getCallerMembership: vi.fn(() => ({
    uid: "admin-uid",
    tenantId: "tenant-1",
    role: "tenantAdmin",
  })),
  assertAutogradePermission: vi.fn(),
}));

vi.mock("../../utils/firestore-helpers", () => ({
  getExam: (...args: any[]) => mockGetExam(...args),
  getExamQuestions: (...args: any[]) => mockGetExamQuestions(...args),
}));

vi.mock("../../utils", () => ({
  parseRequest: vi.fn((data: any) => data),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@levelup/shared-types", () => ({
  SaveExamRequestSchema: {},
}));

import { saveExam } from "../../callable/save-exam";

function makeRequest(data: any) {
  return {
    data,
    auth: { uid: "admin-uid", token: { tenantId: "tenant-1", role: "tenantAdmin" } },
  };
}

describe("saveExam callable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── CREATE ──────────────────────────────────────────────────────────────

  it("creates a new exam when no id is provided", async () => {
    const result = await (saveExam as any)(
      makeRequest({
        tenantId: "tenant-1",
        data: {
          title: "Math Final",
          subject: "Mathematics",
          classIds: ["class-1"],
          totalMarks: 100,
        },
      })
    );

    expect(result.created).toBe(true);
    expect(result.id).toBe("new-exam-id");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Math Final",
        subject: "Mathematics",
        status: "draft",
      })
    );
  });

  it("rejects create when tenantId is missing", async () => {
    await expect((saveExam as any)(makeRequest({ data: { title: "X" } }))).rejects.toThrow(
      "Missing required field: tenantId"
    );
  });

  it("rejects create when required fields are missing", async () => {
    await expect(
      (saveExam as any)(
        makeRequest({
          tenantId: "tenant-1",
          data: { title: "X" },
        })
      )
    ).rejects.toThrow("Missing required fields");
  });

  it("sets default grading config values on create", async () => {
    await (saveExam as any)(
      makeRequest({
        tenantId: "tenant-1",
        data: {
          title: "Test",
          subject: "Science",
          classIds: ["c1"],
        },
      })
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        gradingConfig: expect.objectContaining({
          autoGrade: true,
          allowRubricEdit: true,
          allowManualOverride: true,
        }),
      })
    );
  });

  // ── UPDATE / STATUS TRANSITIONS ─────────────────────────────────────────

  it("publishes exam from question_paper_extracted status", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "question_paper_extracted", title: "E1" });
    mockGetExamQuestions.mockResolvedValue([
      { id: "q1", maxMarks: 10, rubric: { criteria: [{ maxPoints: 10 }] } },
    ]);

    const result = await (saveExam as any)(
      makeRequest({
        id: "e1",
        tenantId: "tenant-1",
        data: { status: "published" },
      })
    );

    expect(result).toEqual({ id: "e1", created: false });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
  });

  it("rejects publish when exam is not in question_paper_extracted", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "draft" });

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { status: "published" },
        })
      )
    ).rejects.toThrow("must be in 'question_paper_extracted'");
  });

  it("rejects publish when exam has no questions", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "question_paper_extracted" });
    mockGetExamQuestions.mockResolvedValue([]);

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { status: "published" },
        })
      )
    ).rejects.toThrow("no questions");
  });

  it("rejects publish when rubric criteria sum does not match maxMarks", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "question_paper_extracted" });
    mockGetExamQuestions.mockResolvedValue([
      { id: "q1", maxMarks: 10, rubric: { criteria: [{ maxPoints: 5 }] } },
    ]);

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { status: "published" },
        })
      )
    ).rejects.toThrow("rubric criteria sum");
  });

  it("rejects invalid status transition (draft -> published)", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "draft" });

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { status: "completed" },
        })
      )
    ).rejects.toThrow("Invalid status transition");
  });

  it("allows valid generic transition (draft -> question_paper_uploaded)", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "draft" });

    const result = await (saveExam as any)(
      makeRequest({
        id: "e1",
        tenantId: "tenant-1",
        data: { status: "question_paper_uploaded" },
      })
    );

    expect(result).toEqual({ id: "e1", created: false });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "question_paper_uploaded" })
    );
  });

  it("rejects field updates when exam is in non-updatable status", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "grading" });

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { title: "New Title" },
        })
      )
    ).rejects.toThrow("Cannot update exam in 'grading'");
  });

  it("allows non-grading field updates after publish", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "published" });

    const result = await (saveExam as any)(
      makeRequest({
        id: "e1",
        tenantId: "tenant-1",
        data: { title: "Updated Title", classIds: ["c1", "c2"] },
      })
    );

    expect(result).toEqual({ id: "e1", created: false });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated Title", classIds: ["c1", "c2"] })
    );
  });

  it("blocks grading-impacting field updates after publish", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "published" });

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { totalMarks: 50 },
        })
      )
    ).rejects.toThrow("'totalMarks' cannot be changed after the exam is published");
  });

  it("updates allowed fields when exam is in draft", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "draft" });

    const result = await (saveExam as any)(
      makeRequest({
        id: "e1",
        tenantId: "tenant-1",
        data: { title: "Updated Title", totalMarks: 80 },
      })
    );

    expect(result).toEqual({ id: "e1", created: false });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated Title", totalMarks: 80 })
    );
  });

  it("rejects update with no valid fields", async () => {
    mockGetExam.mockResolvedValue({ id: "e1", status: "draft" });

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "e1",
          tenantId: "tenant-1",
          data: { invalidField: "value" },
        })
      )
    ).rejects.toThrow("No valid fields to update");
  });

  it("returns not-found when updating non-existent exam", async () => {
    mockGetExam.mockResolvedValue(null);

    await expect(
      (saveExam as any)(
        makeRequest({
          id: "missing",
          tenantId: "tenant-1",
          data: { title: "X" },
        })
      )
    ).rejects.toThrow("not found");
  });
});
