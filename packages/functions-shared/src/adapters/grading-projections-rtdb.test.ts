/**
 * AG-5 seam pin: the Admin-RTDB `GradingProjectionPort` adapter. Verbatim spec:
 *  • setSubmissionStatus → multipath set of `status` + `ownerStudentId` on
 *    `gradingProgress/{t}/submission/{subId}`.
 *  • recordExamPhase → transaction on `gradingProgress/{t}/exam/{examId}` folding
 *    `_index[subId]=phase` and recomputing `agg` via the services-exported
 *    `reduceExamCounts` (so classification can never diverge).
 *  • BEST-EFFORT: RTDB failures log-and-swallow — the ticker is a side-channel
 *    and must never fail the pipeline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { reduceExamCounts } from "@levelup/services";

const update = vi.fn(async (_v: unknown) => {});
const transaction = vi.fn(async (fn: (cur: unknown) => unknown) => ({
  committed: true,
  snapshot: null,
  result: fn(null),
}));
const ref = vi.fn((_path: string) => ({ update, transaction }));

vi.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ ref }),
}));

import { createRtdbGradingProjections } from "./grading-projections-rtdb.js";

beforeEach(() => {
  update.mockClear();
  update.mockResolvedValue(undefined);
  transaction.mockClear();
  ref.mockClear();
});

describe("setSubmissionStatus", () => {
  it("multipath-sets the slim status child + ownerStudentId rules gate", async () => {
    const status = { pipelineStatus: "grading", updatedAt: "2026-07-04T00:00:00.000Z" };
    await createRtdbGradingProjections().setSubmissionStatus("t1", "sub1", {
      ownerStudentId: "stu1",
      status,
    });
    expect(ref).toHaveBeenCalledWith("gradingProgress/t1/submission/sub1");
    expect(update).toHaveBeenCalledWith({ status, ownerStudentId: "stu1" });
  });

  it("swallows RTDB failures (side-channel must not fail the pipeline)", async () => {
    update.mockRejectedValueOnce(new Error("rtdb down"));
    await expect(
      createRtdbGradingProjections().setSubmissionStatus("t1", "sub1", {
        ownerStudentId: "stu1",
        status: { pipelineStatus: "grading", updatedAt: "now" },
      })
    ).resolves.toBeUndefined();
  });
});

describe("recordExamPhase", () => {
  it("folds the phase into _index and recomputes agg via reduceExamCounts", async () => {
    await createRtdbGradingProjections().recordExamPhase(
      "t1",
      "exam1",
      "sub1",
      "grading_complete",
      "2026-07-04T00:00:00.000Z"
    );
    expect(ref).toHaveBeenCalledWith("gradingProgress/t1/exam/exam1");

    // Replay the transaction update fn over an existing node to pin the fold.
    const txFn = transaction.mock.calls[0]![0] as (cur: unknown) => {
      _index: Record<string, string>;
      agg: unknown;
    };
    const existing = { _index: { sub0: "grading" }, agg: { stale: true } };
    const next = txFn(existing);
    expect(next._index).toEqual({ sub0: "grading", sub1: "grading_complete" });
    expect(next.agg).toEqual(
      reduceExamCounts(
        "exam1",
        { sub0: "grading", sub1: "grading_complete" },
        "2026-07-04T00:00:00.000Z"
      )
    );
  });

  it("is idempotent: re-applying the same (submissionId, phase) yields the same aggregate", async () => {
    const projections = createRtdbGradingProjections();
    await projections.recordExamPhase("t1", "exam1", "sub1", "grading", "now");
    const txFn = transaction.mock.calls[0]![0] as (cur: unknown) => { agg: unknown };
    const once = txFn({ _index: { sub1: "grading" } });
    const twice = txFn({ _index: { sub1: "grading" } });
    expect(once.agg).toEqual(twice.agg);
  });

  it("swallows transaction failures", async () => {
    transaction.mockRejectedValueOnce(new Error("rtdb down"));
    await expect(
      createRtdbGradingProjections().recordExamPhase("t1", "e1", "s1", "grading", "now")
    ).resolves.toBeUndefined();
  });
});
