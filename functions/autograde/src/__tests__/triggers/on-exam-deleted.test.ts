/**
 * Unit tests for onExamDeleted trigger.
 * Verifies cascade deletion of questions subcollection, submissions,
 * questionSubmissions, examAnalytics, and tenant stats decrement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockDelete = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue({});

const stableDb: any = {
  doc: vi.fn(() => ({ get: mockGet, delete: mockDelete, update: mockUpdate })),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  batch: vi.fn(() => ({ delete: mockBatchDelete, commit: mockBatchCommit })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
  };
});

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  },
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentDeleted: (_opts: any, handler: any) => handler,
}));

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import handler ──────────────────────────────────────────────────────────
import { onExamDeleted } from "../../triggers/on-exam-deleted";
const handler = onExamDeleted as any;

const TENANT = "tenant-1";
const EXAM_ID = "exam-1";

function makeEvent(params = { tenantId: TENANT, examId: EXAM_ID }) {
  return { params };
}

describe("onExamDeleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete questions subcollection", async () => {
    // Questions subcollection: 2 docs
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 2,
      docs: [
        { ref: { path: `tenants/${TENANT}/exams/${EXAM_ID}/questions/q1` } },
        { ref: { path: `tenants/${TENANT}/exams/${EXAM_ID}/questions/q2` } },
      ],
    });
    // Recurse check: empty (size < 450)

    // Submissions query: empty
    mockGet.mockResolvedValueOnce({ docs: [] });

    // Exam analytics: exists
    mockGet.mockResolvedValueOnce({ exists: true });

    await handler(makeEvent());

    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("should delete submissions and their questionSubmissions", async () => {
    // Questions subcollection: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    // Submissions query: 2 submissions
    const subRef1 = { path: `tenants/${TENANT}/submissions/sub-1`, delete: mockDelete };
    const subRef2 = { path: `tenants/${TENANT}/submissions/sub-2`, delete: mockDelete };
    mockGet.mockResolvedValueOnce({
      docs: [{ ref: subRef1 }, { ref: subRef2 }],
    });

    // questionSubmissions for sub-1: 1 doc
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{ ref: { path: `${subRef1.path}/questionSubmissions/qs1` } }],
    });

    // questionSubmissions for sub-2: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    // Exam analytics: does not exist
    mockGet.mockResolvedValueOnce({ exists: false });

    await handler(makeEvent());

    // sub-1 questionSubmissions batch + sub-1 delete + sub-2 delete
    expect(mockDelete).toHaveBeenCalled();
  });

  it("should delete examAnalytics when it exists", async () => {
    // Questions: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });
    // Submissions: empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Analytics: exists
    mockGet.mockResolvedValueOnce({ exists: true });

    await handler(makeEvent());

    expect(mockDelete).toHaveBeenCalled();
  });

  it("should skip examAnalytics deletion when it does not exist", async () => {
    // Questions: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });
    // Submissions: empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Analytics: not exists
    mockGet.mockResolvedValueOnce({ exists: false });

    await handler(makeEvent());

    // delete is called only for tenant stats update, not for analytics
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("should decrement totalExams in tenant stats", async () => {
    // Questions: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });
    // Submissions: empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Analytics: not exists
    mockGet.mockResolvedValueOnce({ exists: false });

    await handler(makeEvent());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "stats.totalExams": "INCREMENT(-1)",
      })
    );
  });

  it("should batch deletes in chunks of 450", async () => {
    // Create 450 docs to trigger recursion check
    const docs = Array.from({ length: 450 }, (_, i) => ({
      ref: { path: `tenants/${TENANT}/exams/${EXAM_ID}/questions/q${i}` },
    }));
    mockGet.mockResolvedValueOnce({ empty: false, size: 450, docs });
    // Recursion: second batch is empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    // Submissions: empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Analytics: not exists
    mockGet.mockResolvedValueOnce({ exists: false });

    await handler(makeEvent());

    expect(mockBatchDelete).toHaveBeenCalledTimes(450);
    // batch.commit called for the first batch of 450
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("should handle no questions and no submissions gracefully", async () => {
    // Questions: empty
    mockGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });
    // Submissions: empty
    mockGet.mockResolvedValueOnce({ docs: [] });
    // Analytics: not exists
    mockGet.mockResolvedValueOnce({ exists: false });

    await expect(handler(makeEvent())).resolves.not.toThrow();
  });

  it("should handle errors thrown during deletion", async () => {
    // Questions query throws
    mockGet.mockRejectedValueOnce(new Error("Firestore unavailable"));

    await expect(handler(makeEvent())).rejects.toThrow("Firestore unavailable");
  });
});
