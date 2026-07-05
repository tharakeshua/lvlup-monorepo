import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockDelete = vi.fn().mockResolvedValue({});
const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  id: "qb-item-1",
};

const stableDb: any = {
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => ({
    doc: vi.fn(() => mockDocRef),
  })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  };
  return {
    default: { firestore: fsFn, initializeApp: vi.fn() },
    firestore: fsFn,
    initializeApp: vi.fn(),
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

vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../utils/auth", () => ({
  assertAuth: vi.fn().mockReturnValue("user-1"),
  assertTeacherOrAdmin: vi.fn().mockResolvedValue({ role: "teacher" }),
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

import { saveQuestionBankItem } from "../../callable/save-question-bank-item";
const handler = saveQuestionBankItem as any;

function makeRequest(data: Record<string, unknown>, auth?: { uid: string } | null) {
  return {
    data,
    auth: auth === null ? undefined : (auth ?? { uid: "user-1" }),
    rawRequest: {} as any,
  };
}

describe("saveQuestionBankItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when not authenticated", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1" }, null))).rejects.toThrow();
  });

  it("should create a new question bank item", async () => {
    // Wire shape: payload fields ride under the `data` envelope.
    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        data: {
          questionType: "multiple_choice",
          content: "What is 2+2?",
          title: "Basic Math",
          subject: "Math",
          difficulty: "easy",
        },
      })
    );

    expect(result).toBeDefined();
    expect(mockSet).toHaveBeenCalled();
    const setData = mockSet.mock.calls[0][0];
    expect(setData.questionType).toBe("multiple_choice");
    expect(setData.usageCount).toBe(0);
  });

  it("should update an existing question bank item", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ questionType: "multiple_choice", title: "Old Title" }),
    });

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        id: "qb-item-1",
        data: { title: "Updated Title" },
      })
    );

    expect(result).toBeDefined();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("should soft-delete a question bank item", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ title: "To Delete" }),
    });

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        id: "qb-item-1",
        data: { deleted: true },
      })
    );

    expect(result).toBeDefined();
  });

  it("should throw when creating without questionType", async () => {
    await expect(
      handler(makeRequest({ tenantId: "tenant-1", data: { content: "Question without type" } }))
    ).rejects.toThrow();
  });
});
