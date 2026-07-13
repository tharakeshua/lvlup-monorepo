import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHttpsCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
}));

vi.mock("../../firebase", () => ({
  getFirebaseServices: () => ({ functions: "mock-functions" }),
}));

import { callListStoreSpaces, callPurchaseSpace } from "../../levelup/store-callables";

describe("store-callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("callListStoreSpaces calls listStoreSpaces callable", async () => {
    const response = {
      spaces: [
        {
          id: "s1",
          title: "Algebra Basics",
          storeDescription: "Learn algebra",
          storeThumbnailUrl: null,
          subject: "Math",
          labels: ["beginner"],
          price: 0,
          currency: "INR",
          totalStudents: 100,
          totalStoryPoints: 5,
        },
      ],
      hasMore: false,
      lastId: null,
    };
    const mockFn = vi.fn().mockResolvedValue({ data: response });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callListStoreSpaces({ subject: "Math" });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "listStoreSpaces");
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0].title).toBe("Algebra Basics");
  });

  it("callListStoreSpaces passes search and pagination params", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { spaces: [], hasMore: false, lastId: null },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    await callListStoreSpaces({
      subject: "Science",
      search: "physics",
      limit: 10,
      startAfter: "cursor-1",
    });

    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Science",
        search: "physics",
        limit: 10,
        startAfter: "cursor-1",
      })
    );
  });

  it("callPurchaseSpace calls purchaseSpace callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { success: true, transactionId: "tx-123" },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callPurchaseSpace({ spaceId: "s1" });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "purchaseSpace");
    expect(result).toEqual({ success: true, transactionId: "tx-123" });
  });

  it("callPurchaseSpace passes paymentToken", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      data: { success: true, transactionId: "tx-456" },
    });
    mockHttpsCallable.mockReturnValue(mockFn);

    await callPurchaseSpace({ spaceId: "s1", paymentToken: "tok_123" });

    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ paymentToken: "tok_123" }));
  });

  it("propagates errors from callable", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Insufficient funds"));
    mockHttpsCallable.mockReturnValue(mockFn);

    await expect(callPurchaseSpace({ spaceId: "s1" })).rejects.toThrow("Insufficient funds");
  });
});
