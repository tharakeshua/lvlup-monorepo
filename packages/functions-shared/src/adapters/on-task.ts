/**
 * `makeTaskHandler` — the Cloud Tasks queue consumer shell (server-shared.md §2.9).
 * Consumes the single-writer pipeline payloads enqueued by `enqueueTask` /
 * `enqueuePipelineAdvance`, building a tenant-scoped SystemContext and delegating
 * into the pipeline service. Idempotent by the queue's `(submissionId, step)` dedupe id.
 */
import { onTaskDispatched, type Request as TaskRequest } from "firebase-functions/v2/tasks";
import type { TenantId } from "@levelup/domain";
import { REGION, type QueueName } from "../config/config.js";
import { makeSystemContext, type SystemContext } from "../context/auth-context.js";
import { getRepos, getAi, getClock } from "./runtime.js";
import { mapError } from "../request/map-error.js";

export type TaskService<P> = (payload: P, ctx: SystemContext) => Promise<void>;

export interface TaskHandlerOpts {
  /** Field in the payload carrying the tenant id (for tenant-scoped SystemContext). */
  tenantField?: string;
  retryConfig?: { maxAttempts?: number; minBackoffSeconds?: number };
  rateLimits?: { maxConcurrentDispatches?: number; maxDispatchesPerSecond?: number };
}

export function makeTaskHandler<P extends Record<string, unknown>>(
  queue: QueueName,
  service: TaskService<P>,
  opts: TaskHandlerOpts = {}
) {
  return onTaskDispatched(
    {
      region: REGION,
      retryConfig: opts.retryConfig,
      rateLimits: opts.rateLimits,
    },
    async (req: TaskRequest<P>): Promise<void> => {
      try {
        const payload = req.data;
        const tenantId = ((payload?.[opts.tenantField ?? "tenantId"] as string | undefined) ??
          null) as TenantId | null;
        const ctx = makeSystemContext(tenantId, {
          repos: getRepos(),
          ai: getAi(),
          clock: getClock(),
        });
        await service(payload, ctx);
      } catch (e) {
        throw mapError(e);
      }
    }
  );
}
