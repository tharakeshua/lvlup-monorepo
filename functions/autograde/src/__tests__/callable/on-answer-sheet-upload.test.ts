import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockDocGet,
  mockDocUpdate,
  mockDocSet,
  mockCollectionGet,
  mockExamUpdate,
  fakeServerTimestamp,
  fakeIncrement,
} = vi.hoisted(() => ({
  mockDocGet: vi.fn(),
  mockDocUpdate: vi.fn().mockResolvedValue(undefined),
  mockDocSet: vi.fn().mockResolvedValue(undefined),
  mockCollectionGet: vi.fn(),
  mockExamUpdate: vi.fn().mockResolvedValue(undefined),
  fakeServerTimestamp: { _type: "serverTimestamp" },
  fakeIncrement: (n: number) => ({ _type: "increment", value: n }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => fakeServerTimestamp,
    increment: fakeIncrement,
  },
}));

vi.mock("firebase-admin", () => {
  const docFn = (..._args: any[]) => ({
    id: "new-sub-id",
    set: mockDocSet,
    update: mockExamUpdate,
    get: mockDocGet,
  });

  const colFn = (..._args: any[]) => ({
    doc: docFn,
    where: (..._w: any[]) => ({
      where: (..._w2: any[]) => ({
        limit: (..._l: any[]) => ({ get: mockCollectionGet }),
      }),
    }),
  });

  const firestoreFn: any = () => ({
    collection: colFn,
    doc: (...args: any[]) => ({
      id: "mock-doc-id",
      set: mockDocSet,
      update: mockExamUpdate,
      get: mockDocGet,
      ref: { update: mockDocUpdate },
    }),
  });

  firestoreFn.FieldValue = {
    serverTimestamp: () => fakeServerTimestamp,
    increment: fakeIncrement,
  };

  return {
    default: {
      initializeApp: vi.fn(),
      firestore: firestoreFn,
    },
    firestore: firestoreFn,
  };
});

vi.mock("firebase-functions/v2/storage", () => ({
  onObjectFinalized: (_opts: any, handler: Function) => handler,
}));

import { onAnswerSheetUpload } from "../../triggers/on-answer-sheet-upload";

function makeEvent(name: string | undefined, contentType = "image/jpeg") {
  return { data: { name, contentType } };
}

describe("onAnswerSheetUpload trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Path matching / early exits ────────────────────────────────────────

  it("ignores files not in answer-sheets path", async () => {
    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/other/file.jpg"));
    expect(mockDocGet).not.toHaveBeenCalled();
  });

  it("ignores files with no name", async () => {
    await (onAnswerSheetUpload as any)(makeEvent(undefined));
    expect(mockDocGet).not.toHaveBeenCalled();
  });

  it("ignores non-image content types", async () => {
    await (onAnswerSheetUpload as any)(
      makeEvent("tenants/t1/exams/e1/answer-sheets/s1/doc.pdf", "application/pdf")
    );
    expect(mockDocGet).not.toHaveBeenCalled();
  });

  // ── Exam validation ────────────────────────────────────────────────────

  it("ignores upload when exam does not exist", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockCollectionGet).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it("ignores upload when exam is in draft status", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "draft" }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockCollectionGet).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it("ignores upload when exam is in completed status", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "completed" }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockCollectionGet).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  // ── New submission creation ────────────────────────────────────────────

  it("creates new submission when none exists for student", async () => {
    // Exam exists and is published
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "published",
        totalMarks: 100,
        questionPaper: { questionCount: 5 },
      }),
    });
    // No existing submission
    mockCollectionGet.mockResolvedValueOnce({ empty: true, docs: [] });
    // Student document
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        firstName: "John",
        lastName: "Doe",
        rollNumber: "R001",
        classIds: ["class-1"],
      }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        examId: "e1",
        studentId: "s1",
        studentName: "John Doe",
        rollNumber: "R001",
        classId: "class-1",
        pipelineStatus: "uploaded",
        answerSheets: expect.objectContaining({
          images: ["tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"],
          uploadSource: "gcs",
        }),
      })
    );
  });

  it("transitions exam from published to grading on first submission", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "published", totalMarks: 50 }),
    });
    mockCollectionGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ firstName: "Jane" }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockExamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "grading",
        "stats.totalSubmissions": fakeIncrement(1),
      })
    );
  });

  it("does not change exam status when already grading", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "grading", totalMarks: 50 }),
    });
    mockCollectionGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ firstName: "Jane" }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    // The last exam update call should NOT have status
    const calls = mockExamUpdate.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall).not.toHaveProperty("status");
    expect(lastCall).toHaveProperty("stats.totalSubmissions");
  });

  it("uses studentId as name when student doc not found", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "published", totalMarks: 100 }),
    });
    mockCollectionGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockDocGet.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "s1",
        studentName: "s1",
        rollNumber: "",
        classId: "",
      })
    );
  });

  // ── Append to existing submission ──────────────────────────────────────

  it("appends image to existing submission", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "grading", totalMarks: 100 }),
    });
    mockCollectionGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "existing-sub",
          data: () => ({
            answerSheets: {
              images: ["tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"],
            },
          }),
          ref: { update: mockDocUpdate },
        },
      ],
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page2.jpg"));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "answerSheets.images": [
          "tenants/t1/exams/e1/answer-sheets/s1/page1.jpg",
          "tenants/t1/exams/e1/answer-sheets/s1/page2.jpg",
        ],
      })
    );
    // Should NOT create a new submission
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it("skips duplicate image in existing submission", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "grading", totalMarks: 100 }),
    });
    mockCollectionGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "existing-sub",
          data: () => ({
            answerSheets: {
              images: ["tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"],
            },
          }),
          ref: { update: mockDocUpdate },
        },
      ],
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockDocUpdate).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it("initializes images array when existing submission has no images", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "grading", totalMarks: 100 }),
    });
    mockCollectionGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "existing-sub",
          data: () => ({ answerSheets: {} }),
          ref: { update: mockDocUpdate },
        },
      ],
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "answerSheets.images": ["tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"],
      })
    );
  });

  // ── Summary defaults ──────────────────────────────────────────────────

  it("sets default summary with exam totalMarks and questionCount", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "published",
        totalMarks: 200,
        questionPaper: { questionCount: 10 },
      }),
    });
    mockCollectionGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ firstName: "Test" }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalScore: 0,
          maxScore: 200,
          percentage: 0,
          totalQuestions: 10,
        }),
      })
    );
  });

  it("handles missing questionPaper gracefully", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "published" }),
    });
    mockCollectionGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ firstName: "Test" }),
    });

    await (onAnswerSheetUpload as any)(makeEvent("tenants/t1/exams/e1/answer-sheets/s1/page1.jpg"));

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          maxScore: 0,
          totalQuestions: 0,
        }),
      })
    );
  });
});
