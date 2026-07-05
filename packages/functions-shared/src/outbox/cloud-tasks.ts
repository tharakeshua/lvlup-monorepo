/**
 * Cloud Tasks enqueue helper (server-shared.md §2.8). Single-writer, multi-step
 * orchestration (the autograde grading pipeline). Uses
 * `firebase-admin/functions` `getFunctions().taskQueue(name).enqueue(...)` — the
 * Admin-SDK pairing for `onTaskDispatched` handlers (no extra GCP client dep).
 *
 * Pipeline-advance pattern: each step service does its work, writes its
 * projection, then `enqueuePipelineAdvance({tenantId, submissionId, step})` —
 * idempotent via the `(submissionId, step)` dedupe id, so retries never
 * double-grade.
 */
import { getFunctions } from "firebase-admin/functions";
import { logger } from "firebase-functions/v2";
import type { SubmissionId, TenantId } from "@levelup/domain";
import { QUEUES, REGION, type QueueName } from "../config/config.js";

export interface EnqueueOpts {
  scheduleDelaySec?: number;
  /** Dedupe id → Cloud Tasks task name (prevents duplicate steps). */
  dedupeId?: string;
}

/** The grading pipeline steps — MUST mirror `@levelup/services`
 *  `advance-pipeline.ts` `PipelineStep` (the reducer this queue drives). */
export type PipelineStep = "scouting" | "grading" | "finalize";

interface EnqueueablePayload {
  [key: string]: unknown;
}

/**
 * Queue → DEPLOYED task-handler function id. `taskQueue()` targets a FUNCTION
 * (the queue Cloud Functions provisions is named after it), not a bare queue
 * name — `taskQueue('grading-pipeline')` would target a queue that never
 * exists. Ids follow the sdk-v1 nested-export grammar `v1-<module>-<op>`
 * (functions/sdk-v1/src/index.ts) and are region-qualified below because the
 * Admin SDK otherwise assumes us-central1.
 */
const QUEUE_FUNCTION_IDS: Partial<Record<QueueName, string>> = {
  [QUEUES.gradingPipeline]: "v1-autograde-advancePipeline",
  [QUEUES.studentRollup]: "v1-analytics-recomputeStudentRollup",
};

/** Region-qualified partial resource name for the queue's handler function. */
export function taskFunctionRef(queue: QueueName): string {
  const fn = QUEUE_FUNCTION_IDS[queue];
  if (!fn) {
    throw new Error(`[cloud-tasks] no deployed task handler mapped for queue '${queue}'`);
  }
  return `locations/${REGION}/functions/${fn}`;
}

/**
 * Enqueue a Cloud Task onto `queue`, targeting its deployed `makeTaskHandler`
 * consumer. An ALREADY_EXISTS on a deduped enqueue means the step is already
 * queued (or just ran) — the dedupe WORKING — so it resolves successfully; the
 * stale-submission watchdog re-drives anything that genuinely stalls.
 */
export async function enqueueTask<P extends EnqueueablePayload>(
  queue: QueueName,
  payload: P,
  opts: EnqueueOpts = {}
): Promise<void> {
  const tq = getFunctions().taskQueue<P>(taskFunctionRef(queue));
  try {
    await tq.enqueue(payload, {
      scheduleDelaySeconds: opts.scheduleDelaySec,
      id: opts.dedupeId,
    });
  } catch (e) {
    if (opts.dedupeId && isAlreadyExists(e)) {
      logger.debug(`[cloud-tasks] dedupe hit on ${queue}/${opts.dedupeId} — already enqueued`);
      return;
    }
    throw e;
  }
}

/** Advance the grading pipeline by one step (idempotent on (submissionId, step)).
 *  `tenantId` rides the payload — the `makeTaskHandler` consumer rebuilds a
 *  tenant-scoped SystemContext from it (`tenantField: 'tenantId'`). */
export async function enqueuePipelineAdvance(
  req: {
    tenantId: TenantId | string | null;
    submissionId: SubmissionId | string;
    step: PipelineStep | string;
  },
  opts: { scheduleDelaySec?: number } = {}
): Promise<void> {
  await enqueueTask(
    QUEUES.gradingPipeline,
    {
      tenantId: req.tenantId === null ? null : String(req.tenantId),
      submissionId: String(req.submissionId),
      step: req.step,
    },
    {
      scheduleDelaySec: opts.scheduleDelaySec,
      dedupeId: `${String(req.submissionId)}__${String(req.step)}`,
    }
  );
}

/** Cloud Tasks rejects a reused task id with ALREADY_EXISTS (HTTP 409). */
function isAlreadyExists(e: unknown): boolean {
  const err = e as { code?: unknown; status?: unknown; message?: unknown } | null;
  const code = String(err?.code ?? "");
  const status = String(err?.status ?? "");
  const message = String(err?.message ?? "");
  return (
    code.includes("already-exists") ||
    status === "409" ||
    status === "ALREADY_EXISTS" ||
    message.includes("ALREADY_EXISTS") ||
    message.toLowerCase().includes("already exists")
  );
}
