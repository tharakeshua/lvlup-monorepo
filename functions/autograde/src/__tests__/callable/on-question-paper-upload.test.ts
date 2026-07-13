import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockTxnGet, mockTxnUpdate, fakeServerTimestamp } = vi.hoisted(() => ({
  mockTxnGet: vi.fn(),
  mockTxnUpdate: vi.fn(),
  fakeServerTimestamp: { _type: "serverTimestamp" },
}));

vi.mock("firebase-admin", () => {
  const docFn = (..._args: any[]) => ({
    id: "exam-id",
    update: vi.fn(),
    get: vi.fn(),
  });

  const firestoreFn: any = () => ({
    doc: docFn,
    runTransaction: vi.fn(async (fn: Function) => {
      const txn = {
        get: mockTxnGet,
        update: mockTxnUpdate,
      };
      await fn(txn);
    }),
  });

  firestoreFn.FieldValue = {
    serverTimestamp: () => fakeServerTimestamp,
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

import { onQuestionPaperUpload } from "../../triggers/on-question-paper-upload";

function makeEvent(name: string | undefined, contentType = "image/jpeg") {
  return { data: { name, contentType } };
}

describe("onQuestionPaperUpload trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores files not in question-paper path", async () => {
    await (onQuestionPaperUpload as any)(makeEvent("tenants/t1/exams/e1/other/file.jpg"));
    expect(mockTxnGet).not.toHaveBeenCalled();
  });

  it("ignores files with no name", async () => {
    await (onQuestionPaperUpload as any)(makeEvent(undefined));
    expect(mockTxnGet).not.toHaveBeenCalled();
  });

  it("ignores non-image content types", async () => {
    await (onQuestionPaperUpload as any)(
      makeEvent("tenants/t1/exams/e1/question-paper/doc.pdf", "application/pdf")
    );
    expect(mockTxnGet).not.toHaveBeenCalled();
  });

  it("updates exam with image path and transitions to question_paper_uploaded", async () => {
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "draft", questionPaper: {} }),
    });

    await (onQuestionPaperUpload as any)(makeEvent("tenants/t1/exams/e1/question-paper/page1.jpg"));

    expect(mockTxnUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        "questionPaper.images": ["tenants/t1/exams/e1/question-paper/page1.jpg"],
        status: "question_paper_uploaded",
      })
    );
  });

  it("appends to existing images array", async () => {
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "question_paper_uploaded",
        questionPaper: { images: ["tenants/t1/exams/e1/question-paper/page1.jpg"] },
      }),
    });

    await (onQuestionPaperUpload as any)(makeEvent("tenants/t1/exams/e1/question-paper/page2.jpg"));

    expect(mockTxnUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        "questionPaper.images": [
          "tenants/t1/exams/e1/question-paper/page1.jpg",
          "tenants/t1/exams/e1/question-paper/page2.jpg",
        ],
      })
    );
  });

  it("skips duplicate image paths", async () => {
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "question_paper_uploaded",
        questionPaper: { images: ["tenants/t1/exams/e1/question-paper/page1.jpg"] },
      }),
    });

    await (onQuestionPaperUpload as any)(makeEvent("tenants/t1/exams/e1/question-paper/page1.jpg"));

    expect(mockTxnUpdate).not.toHaveBeenCalled();
  });

  it("ignores upload when exam does not exist", async () => {
    mockTxnGet.mockResolvedValue({ exists: false });

    await (onQuestionPaperUpload as any)(makeEvent("tenants/t1/exams/e1/question-paper/page1.jpg"));

    expect(mockTxnUpdate).not.toHaveBeenCalled();
  });

  it("ignores upload when exam is in non-applicable status", async () => {
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "published", questionPaper: {} }),
    });

    await (onQuestionPaperUpload as any)(makeEvent("tenants/t1/exams/e1/question-paper/page1.jpg"));

    expect(mockTxnUpdate).not.toHaveBeenCalled();
  });
});
