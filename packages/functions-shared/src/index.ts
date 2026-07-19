/**
 * `@levelup/functions-shared` (published as `@levelup/functions-adapters`) — the
 * thin adapter layer between the four function codebases and `@levelup/services`.
 *
 * The ONLY package in services-and-below that imports `firebase-functions`. The
 * four codebases import ONLY from here + `@levelup/services`.
 *
 *   …`@levelup/services` ← **`@levelup/functions-shared`** ← functions/*
 */

// ---- context (the trust boundary) ----
export type { AuthContext, SystemContext } from "./context/auth-context.js";
export { makeSystemContext } from "./context/auth-context.js";
export { buildAuthContext, type BuildCtxOptions } from "./context/build-auth-context.js";
export type { AuthInfo } from "./context/callable-auth.js";
export type {
  Repos,
  AiGateway,
  AiRequest,
  AiResponse,
  AiCallContext,
  TxHandle,
  TokenUsage,
  CostBreakdown,
  IdempotencyRepo,
  OutboxRepo,
  OutboxRecord,
  OutboxRecordInput,
  AuditRepo,
  AuditRecord,
  RateLimitRepo,
  TenantRepo,
  TenantLike,
  MembershipRepo,
  ClaimsRepo,
  StorageSignerPort,
  PipelineEnqueuePort,
  PipelineAdvanceRequest,
} from "./context/ports.js";

// ---- adapters (the thin shells) ----
export { makeCallable, type ServiceFn } from "./adapters/on-call.js";
export {
  makeTrigger,
  prefixTriggerDocument,
  type TriggerRef,
  type TriggerEvent,
  type TriggerEventType,
  type TriggerService,
} from "./adapters/on-document.js";
export { makeScheduler, type SchedulerService } from "./adapters/on-schedule.js";
export { makeTaskHandler, type TaskService, type TaskHandlerOpts } from "./adapters/on-task.js";
export {
  configureRuntime,
  getRepos,
  getAi,
  getClock,
  getStorage,
  getPipelineTasks,
  type RuntimeDeps,
} from "./adapters/runtime.js";
export { createAdminStorageSigner } from "./adapters/storage.js";
export { createRtdbGradingProjections } from "./adapters/grading-projections-rtdb.js";
export { createRtdbExtractionProjections } from "./adapters/extraction-projections-rtdb.js";
export { createRtdbLevelupProjections } from "./adapters/levelup-projections-rtdb.js";

// ---- request / error model ----
export { parseRequest } from "./request/parse-request.js";
export { fail } from "./request/fail.js";
export { mapError } from "./request/map-error.js";
export { AccessError } from "@levelup/access";

// ---- limits ----
export { enforceRateLimit, RATE_TIER_LIMITS } from "./limits/rate-limit.js";
export { assertFeatureEnabled } from "./limits/feature-gate.js";
export { assertQuota, type QuotaResource } from "./limits/quota.js";

// ---- idempotency ----
export { dedupe } from "./idempotency/dedupe.js";

// ---- outbox + cloud tasks ----
export {
  enqueueOutbox,
  drainOutbox,
  type OutboxEventType,
  type EnqueueOutboxInput,
} from "./outbox/outbox.js";
export {
  enqueueTask,
  enqueuePipelineAdvance,
  taskFunctionRef,
  type PipelineStep,
  type EnqueueOpts,
} from "./outbox/cloud-tasks.js";

// ---- audit ----
export { writeAudit } from "./audit/audit.js";

// ---- config ----
export {
  REGION,
  QUEUES,
  type QueueName,
  projectId,
  secretNameFor,
  VALIDATE_RESPONSES,
} from "./config/config.js";
