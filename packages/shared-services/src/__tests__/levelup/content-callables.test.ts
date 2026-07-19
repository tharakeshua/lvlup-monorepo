import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHttpsCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
}));

vi.mock("../../firebase", () => ({
  getFirebaseServices: () => ({ functions: "mock-functions" }),
}));

import {
  callSaveQuestionBankItem,
  callListQuestionBank,
  callImportFromBank,
  callSaveRubricPreset,
  callSaveSpaceReview,
  callListVersions,
} from "../../levelup/content-callables";

describe("content-callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("callSaveQuestionBankItem calls saveQuestionBankItem callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { id: "qb-1", created: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callSaveQuestionBankItem({
      tenantId: "t1",
      data: { questionType: "mcq", title: "Test Question" },
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "saveQuestionBankItem");
    expect(result).toEqual({ id: "qb-1", created: true });
  });

  it("callSaveQuestionBankItem handles update (with id)", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { id: "qb-1", created: false } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callSaveQuestionBankItem({
      id: "qb-1",
      tenantId: "t1",
      data: { title: "Updated" },
    });

    expect(result).toEqual({ id: "qb-1", created: false });
  });

  it("callListQuestionBank calls listQuestionBank callable", async () => {
    const response = { items: [{ id: "1" }], hasMore: false, lastId: null };
    const mockFn = vi.fn().mockResolvedValue({ data: response });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callListQuestionBank({ tenantId: "t1", subject: "Math" });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "listQuestionBank");
    expect(result).toEqual(response);
  });

  it("callListQuestionBank passes all filter params", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { items: [], hasMore: false, lastId: null } });
    mockHttpsCallable.mockReturnValue(mockFn);

    await callListQuestionBank({
      tenantId: "t1",
      subject: "Math",
      topics: ["algebra"],
      difficulty: "hard",
      bloomsLevel: "analyze",
      questionType: "mcq",
      tags: ["tag1"],
      search: "quadratic",
      sortBy: "createdAt",
      sortDir: "desc",
      limit: 10,
      startAfter: "cursor-1",
    });

    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Math",
        difficulty: "hard",
        limit: 10,
      })
    );
  });

  it("callImportFromBank calls importFromBank callable", async () => {
    const response = { imported: 3, itemIds: ["i1", "i2", "i3"] };
    const mockFn = vi.fn().mockResolvedValue({ data: response });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callImportFromBank({
      tenantId: "t1",
      spaceId: "s1",
      storyPointId: "sp1",
      questionBankItemIds: ["qb-1", "qb-2", "qb-3"],
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "importFromBank");
    expect(result).toEqual(response);
  });

  it("callSaveRubricPreset calls saveRubricPreset callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { id: "rp-1", created: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callSaveRubricPreset({
      tenantId: "t1",
      data: { name: "Default Rubric", category: "essay" },
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "saveRubricPreset");
    expect(result).toEqual({ id: "rp-1", created: true });
  });

  it("callSaveSpaceReview calls saveSpaceReview callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true, isUpdate: false } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callSaveSpaceReview({
      tenantId: "t1",
      spaceId: "s1",
      rating: 5,
      comment: "Excellent!",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "saveSpaceReview");
    expect(result).toEqual({ success: true, isUpdate: false });
  });

  it("callListVersions calls listVersions callable", async () => {
    const response = { versions: [{ id: "v1", version: 1 }], hasMore: false, lastId: null };
    const mockFn = vi.fn().mockResolvedValue({ data: response });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callListVersions({
      tenantId: "t1",
      spaceId: "s1",
      entityType: "space",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "listVersions");
    expect(result).toEqual(response);
  });

  it("propagates errors from callable", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Permission denied"));
    mockHttpsCallable.mockReturnValue(mockFn);

    await expect(
      callSaveQuestionBankItem({ tenantId: "t1", data: { title: "X" } })
    ).rejects.toThrow("Permission denied");
  });
});
