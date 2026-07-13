import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHttpsCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
}));

vi.mock("../../firebase", () => ({
  getFirebaseServices: () => ({ functions: "mock-functions" }),
}));

import {
  callStartTestSession,
  callSubmitTestSession,
  callEvaluateAnswer,
  callRecordItemAttempt,
} from "../../levelup/assessment-callables";

describe("assessment-callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("callStartTestSession calls startTestSession callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { sessionId: "sess-1" } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callStartTestSession({
      tenantId: "t1",
      spaceId: "s1",
      storyPointId: "sp1",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "startTestSession");
    expect(result).toEqual({ sessionId: "sess-1" });
  });

  it("callSubmitTestSession calls submitTestSession callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callSubmitTestSession({
      tenantId: "t1",
      sessionId: "sess-1",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "submitTestSession");
    expect(result).toEqual({ success: true });
  });

  it("callSubmitTestSession passes autoSubmitted flag", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    await callSubmitTestSession({
      tenantId: "t1",
      sessionId: "sess-1",
      autoSubmitted: true,
    });

    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ autoSubmitted: true }));
  });

  it("callEvaluateAnswer calls evaluateAnswer callable", async () => {
    const evalResult = { score: 10, maxScore: 10, correctness: 1 };
    const mockFn = vi.fn().mockResolvedValue({ data: evalResult });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callEvaluateAnswer({
      tenantId: "t1",
      spaceId: "s1",
      storyPointId: "sp1",
      itemId: "i1",
      answer: "A",
      mode: "practice",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "evaluateAnswer");
    expect(result).toEqual(evalResult);
  });

  it("callRecordItemAttempt calls recordItemAttempt callable", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await callRecordItemAttempt({
      tenantId: "t1",
      spaceId: "s1",
      storyPointId: "sp1",
      itemId: "i1",
      itemType: "mcq",
      score: 5,
      maxScore: 10,
      correct: false,
      timeSpent: 30,
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith("mock-functions", "recordItemAttempt");
    expect(result).toEqual({ success: true });
  });

  it("callRecordItemAttempt passes optional fields", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockFn);

    await callRecordItemAttempt({
      tenantId: "t1",
      spaceId: "s1",
      storyPointId: "sp1",
      itemId: "i1",
      itemType: "mcq",
      score: 10,
      maxScore: 10,
      correct: true,
      feedback: "Great job!",
    });

    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ feedback: "Great job!" }));
  });

  it("propagates errors from callable", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));
    mockHttpsCallable.mockReturnValue(mockFn);

    await expect(
      callStartTestSession({ tenantId: "t1", spaceId: "s1", storyPointId: "sp1" })
    ).rejects.toThrow("Network error");
  });
});
