/**
 * Cloud Tasks enqueue helper (server-shared.md §2.8). Single-writer, multi-step
 * orchestration (the autograde grading pipeline). Uses
 * `firebase-admin/functions` `getFunctions().taskQueue(name).enqueue(...)`.
 *
 * Pipeline-advance pattern: each step service does its work, writes its
 * projection, then `enqueuePipelineAdvance(submissionId, nextStep)` — idempotent
 * via the `(submissionId, step)` dedupe id, so retries never double-grade.
 */
import { getFunctions } from "firebase-admin/functions";
import type { SubmissionId } from "@levelup/domain";
import { QUEUES, REGION, type QueueName } from "../config/config.js";

export interface EnqueueOpts {
  scheduleDelaySec?: number;
  /** Dedupe id → Cloud Tasks task name (prevents duplicate steps). */
  dedupeId?: string;
}

/** The grading pipeline steps (single-writer reducer states). */
export type PipelineStep = "mapping" | "grading" | "finalize" | "release";

interface EnqueueablePayload {
  [key: string]: unknown;
}

/**
 * Enqueue a Cloud Task onto `queue`, targeting the deployed task handler whose
 * name matches the queue (the `makeTaskHandler` consumer). The handler param is
 * the function name registered in the codebase; we resolve via the admin SDK
 * queue handle which already knows the target function for the named queue.
 */
export async function enqueueTask<P extends EnqueueablePayload>(
  queue: QueueName,
  payload: P,
  opts: EnqueueOpts = {}
): Promise<void> {
  const tq = getFunctions().taskQueue(queue);
  await tq.enqueue(payload, {
    scheduleDelaySeconds: opts.scheduleDelaySec,
    id: opts.dedupeId,
    // Region is implicit in the deployed queue; included for clarity/parity.
    ...(REGION ? {} : {}),
  });
}

/** Advance the grading pipeline by one step (idempotent on (submissionId, step)). */
export async function enqueuePipelineAdvance(
  submissionId: SubmissionId | string,
  step: PipelineStep,
  opts: { scheduleDelaySec?: number } = {}
): Promise<void> {
  await enqueueTask(
    QUEUES.gradingPipeline,
    { submissionId: String(submissionId), step },
    {
      scheduleDelaySec: opts.scheduleDelaySec,
      dedupeId: `${String(submissionId)}__${step}`,
    }
  );
}
