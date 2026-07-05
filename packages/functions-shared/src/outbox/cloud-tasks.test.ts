/**
 * P1-F pin: the Cloud Tasks enqueue seam. Three live-diagnosed hazards:
 *  1. `taskQueue()` must target the DEPLOYED HANDLER FUNCTION (region-qualified),
 *     not the bare queue name — `taskQueue('grading-pipeline')` targets nothing.
 *  2. The payload must carry `tenantId` or the `makeTaskHandler` consumer builds
 *     a tenant-null SystemContext and the reducer dies on TENANT_REQUIRED.
 *  3. A deduped ALREADY_EXISTS re-enqueue is the dedupe WORKING — must resolve,
 *     not throw (the watchdog re-drives genuine stalls).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const enqueue = vi.fn<(payload: unknown, opts: unknown) => Promise<void>>(async () => {});
const taskQueue = vi.fn((_name: string) => ({ enqueue }));

vi.mock("firebase-admin/functions", () => ({
  getFunctions: () => ({ taskQueue }),
}));

import { enqueueTask, enqueuePipelineAdvance, taskFunctionRef } from "./cloud-tasks.js";
import { QUEUES, REGION } from "../config/config.js";

beforeEach(() => {
  enqueue.mockClear();
  enqueue.mockResolvedValue(undefined);
  taskQueue.mockClear();
});

describe("taskFunctionRef", () => {
  it("region-qualifies the deployed v1-<module>-<op> handler id", () => {
    expect(taskFunctionRef(QUEUES.gradingPipeline)).toBe(
      `locations/${REGION}/functions/v1-autograde-advancePipeline`
    );
    expect(taskFunctionRef(QUEUES.studentRollup)).toBe(
      `locations/${REGION}/functions/v1-analytics-recomputeStudentRollup`
    );
  });

  it("throws loudly for a queue with no deployed handler", () => {
    expect(() => taskFunctionRef(QUEUES.outboxDrain)).toThrow(/no deployed task handler/);
  });
});

describe("enqueuePipelineAdvance", () => {
  it("targets the pipeline handler with a tenant-scoped payload + (submissionId, step) dedupe id", async () => {
    await enqueuePipelineAdvance({ tenantId: "t1", submissionId: "sub1", step: "grading" });
    expect(taskQueue).toHaveBeenCalledWith(
      `locations/${REGION}/functions/v1-autograde-advancePipeline`
    );
    expect(enqueue).toHaveBeenCalledWith(
      { tenantId: "t1", submissionId: "sub1", step: "grading" },
      { scheduleDelaySeconds: undefined, id: "sub1__grading" }
    );
  });

  it("swallows ALREADY_EXISTS on a deduped enqueue (dedupe hit, not a failure)", async () => {
    enqueue.mockRejectedValueOnce(new Error("Task ALREADY_EXISTS in queue"));
    await expect(
      enqueuePipelineAdvance({ tenantId: "t1", submissionId: "sub1", step: "finalize" })
    ).resolves.toBeUndefined();
  });

  it("rethrows non-dedupe enqueue failures", async () => {
    enqueue.mockRejectedValueOnce(new Error("PERMISSION_DENIED"));
    await expect(
      enqueuePipelineAdvance({ tenantId: "t1", submissionId: "sub1", step: "scouting" })
    ).rejects.toThrow(/PERMISSION_DENIED/);
  });
});

describe("enqueueTask", () => {
  it("rethrows ALREADY_EXISTS when the caller did NOT ask for dedupe", async () => {
    enqueue.mockRejectedValueOnce(new Error("ALREADY_EXISTS"));
    await expect(enqueueTask(QUEUES.gradingPipeline, { x: 1 })).rejects.toThrow(/ALREADY_EXISTS/);
  });

  it("passes the schedule delay through", async () => {
    await enqueueTask(QUEUES.gradingPipeline, { x: 1 }, { scheduleDelaySec: 30, dedupeId: "d1" });
    expect(enqueue).toHaveBeenCalledWith({ x: 1 }, { scheduleDelaySeconds: 30, id: "d1" });
  });
});
