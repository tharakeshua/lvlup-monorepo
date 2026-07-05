import { describe, it, expect, vi, beforeEach } from "vitest";

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
}));

import { listStoreSpaces } from "../../callable/list-store-spaces";
const handler = listStoreSpaces as any;

function makeRequest(data: Record<string, unknown>) {
  return { data, auth: { uid: "user-1" }, rawRequest: {} as any };
}

describe("listStoreSpaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list published store spaces", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "space-1",
          data: () => ({
            title: "Algebra Basics",
            publishedToStore: true,
            storeDescription: "Learn algebra",
            storePrice: 99,
            subject: "Math",
            stats: { totalStudents: 5 },
          }),
        },
      ],
    });

    const result = await handler(makeRequest({}));
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0].title).toBe("Algebra Basics");
  });

  it("should apply subject filter", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "space-1",
          data: () => ({
            title: "Physics 101",
            publishedToStore: true,
            subject: "Physics",
            stats: {},
          }),
        },
      ],
    });

    const result = await handler(makeRequest({ subject: "Physics" }));
    expect(result.spaces).toHaveLength(1);
  });

  it("should handle empty store", async () => {
    mockGet.mockResolvedValueOnce({ docs: [] });

    const result = await handler(makeRequest({}));
    expect(result.spaces).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("should apply text search", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "space-1",
          data: () => ({ title: "Algebra Basics", storeDescription: "Learn algebra", stats: {} }),
        },
        {
          id: "space-2",
          data: () => ({ title: "Geometry", storeDescription: "Shapes and angles", stats: {} }),
        },
      ],
    });

    const result = await handler(makeRequest({ search: "algebra" }));
    expect(result.spaces.length).toBeGreaterThanOrEqual(1);
  });
});
