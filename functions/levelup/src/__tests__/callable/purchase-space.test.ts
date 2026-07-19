import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});
const mockDocRef = { get: mockGet, set: mockSet, update: mockUpdate, id: "txn-1" };

const stableDb: any = {
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => ({ doc: vi.fn(() => mockDocRef) })),
};

vi.mock("firebase-admin", () => {
  const fsFn: any = () => stableDb;
  fsFn.FieldValue = {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
    arrayUnion: vi.fn((...args: any[]) => `ARRAY_UNION(${args.join(",")})`),
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
}));

vi.mock("../../utils/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

import { purchaseSpace } from "../../callable/purchase-space";
const handler = purchaseSpace as any;

function makeRequest(data: Record<string, unknown>) {
  return { data, auth: { uid: "user-1" }, rawRequest: {} as any };
}

describe("purchaseSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when space not found", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(handler(makeRequest({ spaceId: "nonexistent" }))).rejects.toThrow();
  });

  it("should throw when space not published to store", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ publishedToStore: false }),
    });
    await expect(handler(makeRequest({ spaceId: "space-1" }))).rejects.toThrow();
  });

  it("should throw when user already enrolled", async () => {
    // Space doc
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ publishedToStore: true, storePrice: 99 }),
    });

    // User doc - already enrolled
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        consumerProfile: { enrolledSpaceIds: ["space-1"] },
      }),
    });

    await expect(handler(makeRequest({ spaceId: "space-1" }))).rejects.toThrow();
  });

  it("should purchase space successfully", async () => {
    // Space doc
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        publishedToStore: true,
        storePrice: 99,
        title: "Algebra Basics",
      }),
    });

    // User doc - not enrolled
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        consumerProfile: { enrolledSpaceIds: [] },
      }),
    });

    const result = await handler(makeRequest({ spaceId: "space-1" }));
    expect(result).toMatchObject({ success: true });
    expect(result.transactionId).toBeDefined();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
