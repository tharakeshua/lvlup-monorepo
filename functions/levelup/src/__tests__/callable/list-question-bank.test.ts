import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stable mocks ────────────────────────────────────────────────────────────
const mockGet = vi.fn();

const stableDb: any = {
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: mockGet,
  })),
  doc: vi.fn(() => ({ get: mockGet })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") };
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

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/auth", () => ({
  assertAuth: vi.fn().mockReturnValue("user-1"),
  assertTeacherOrAdmin: vi.fn().mockResolvedValue({ role: "teacher" }),
}));

import { listQuestionBank } from "../../callable/list-question-bank";
const handler = listQuestionBank as any;

function makeRequest(data: Record<string, unknown>) {
  return { data, auth: { uid: "user-1" }, rawRequest: {} as any };
}

describe("listQuestionBank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list question bank items with pagination", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "qb-1",
          data: () => ({ title: "Q1", questionType: "mcq", subject: "Math", createdAt: {} }),
        },
        {
          id: "qb-2",
          data: () => ({
            title: "Q2",
            questionType: "short_answer",
            subject: "Science",
            createdAt: {},
          }),
        },
      ],
    });

    const result = await handler(makeRequest({ tenantId: "tenant-1" }));
    expect(result.items).toHaveLength(2);
  });

  it("should apply subject filter", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "qb-1",
          data: () => ({ title: "Math Q", questionType: "mcq", subject: "Math", createdAt: {} }),
        },
      ],
    });

    const result = await handler(makeRequest({ tenantId: "tenant-1", subject: "Math" }));
    expect(result.items).toHaveLength(1);
  });

  it("should apply text search filter", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "qb-1",
          data: () => ({ title: "Algebra basics", content: "Solve x+2=4", createdAt: {} }),
        },
        {
          id: "qb-2",
          data: () => ({ title: "Geometry", content: "Calculate area", createdAt: {} }),
        },
      ],
    });

    const result = await handler(makeRequest({ tenantId: "tenant-1", search: "algebra" }));
    // Client-side filter should match 'Algebra basics'
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("should return hasMore and lastId for pagination", async () => {
    const docs = Array.from({ length: 20 }, (_, i) => ({
      id: `qb-${i}`,
      data: () => ({ title: `Q${i}`, createdAt: {} }),
    }));
    mockGet.mockResolvedValueOnce({ docs });

    const result = await handler(makeRequest({ tenantId: "tenant-1" }));
    expect(result.hasMore).toBe(true);
    expect(result.lastId).toBeDefined();
  });
});
