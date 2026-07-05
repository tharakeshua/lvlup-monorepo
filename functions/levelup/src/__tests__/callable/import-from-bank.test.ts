import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockBatch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue({}) };
const mockDocRef = { get: mockGet, set: mockSet, update: mockUpdate, id: "item-1" };

const mockGetAll = vi.fn();

const stableDb: any = {
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => ({
    doc: vi.fn(() => mockDocRef),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  getAll: mockGetAll,
  batch: vi.fn(() => mockBatch),
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

vi.mock("../../utils/firestore", () => ({
  loadStoryPoint: vi.fn().mockResolvedValue({ id: "sp-1", type: "standard" }),
}));

import { importFromBank } from "../../callable/import-from-bank";
const handler = importFromBank as any;

function makeRequest(data: Record<string, unknown>) {
  return { data, auth: { uid: "user-1" }, rawRequest: {} as any };
}

describe("importFromBank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when required fields are missing", async () => {
    await expect(handler(makeRequest({ tenantId: "tenant-1" }))).rejects.toThrow();
  });

  it("should throw when questionBankItemIds exceeds max limit", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `qb-${i}`);
    await expect(
      handler(
        makeRequest({
          tenantId: "tenant-1",
          spaceId: "space-1",
          storyPointId: "sp-1",
          questionBankItemIds: ids,
        })
      )
    ).rejects.toThrow();
  });

  it("should import questions from bank into story point", async () => {
    // Bank items are fetched via db.getAll(); the doc must satisfy the
    // QuestionBankItem doc-parse schema or the handler skips it.
    mockGetAll.mockResolvedValueOnce([
      {
        id: "qb-1",
        exists: true,
        ref: mockDocRef,
        data: () => ({
          tenantId: "tenant-1",
          questionType: "mcq",
          title: "Q1",
          content: "What is 2+2?",
          basePoints: 5,
          questionData: { options: [] },
          subject: "Math",
          topics: [],
          difficulty: "easy",
          usageCount: 0,
          tags: [],
          createdBy: "user-1",
          createdAt: { seconds: 1, nanoseconds: 0 },
          updatedAt: { seconds: 1, nanoseconds: 0 },
        }),
      },
    ]);

    // Existing items (for orderIndex — nested + flat lookups)
    mockGet.mockResolvedValue({ empty: true, docs: [], size: 0 });

    const result = await handler(
      makeRequest({
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        questionBankItemIds: ["qb-1"],
      })
    );

    expect(result).toMatchObject({ success: true, importedCount: 1 });
    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });
});
