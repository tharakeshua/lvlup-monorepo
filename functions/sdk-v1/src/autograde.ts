/**
 * `v1.autograde.*` callable / trigger / scheduler / task wiring (region asia-south1,
 * per SDK-LAYERS-PLAN §2.5). THIN shells over `@levelup/services` — no business
 * logic lives here. Runtime ports (repos/ai/clock) are injected by `./bootstrap`
 * (imported first in index.ts); do NOT re-wire them here.
 *
 * Each `export const <op>` becomes a property of the nested `v1.autograde` group in
 * index.ts, so its deployed/emulator id is `v1-autograde-<op>` and the dotted
 * contract name `v1.autograde.<op>` maps to it (see index.ts header).
 */
import {
  makeCallable,
  makeTrigger,
  makeScheduler,
  makeTaskHandler,
  QUEUES,
  type ServiceFn,
  type TriggerEvent as AdapterTriggerEvent,
  type SystemContext as AdapterSystemContext,
} from "@levelup/functions-adapters";
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import * as services from "@levelup/services";
import type {
  AuthContext as ServicesAuthContext,
  SystemContext as ServicesSystemContext,
  TriggerEvent as ServiceTriggerEvent,
} from "@levelup/services";

// ─────────────────────────────────────────────────────────────────────────────
// Wire helpers — the SINGLE sanctioned T9 ctx-seam cast (the symmetric twin of
// bootstrap.ts's injection cast and of levelup.ts/analytics.ts's `call`). A
// `@levelup/services` service fn types `ctx` against the services
// `AuthContext`/`SystemContext` (rich repo-admin `Repos`); the adapter shells type
// `ctx` against the deliberately-minimal structural port (`context/ports.ts`).
// bootstrap injects ONE concrete `createRepos()` into both, so they are
// runtime-identical but nominally distinct ONLY at the `repos` port. Each helper
// casts ONLY that ctx seam; request/response stay fully contract-checked via
// `ReqOf`/`ResOf`. No `any`; no test weakening.
// ─────────────────────────────────────────────────────────────────────────────

/** Callable wire: services `(input, ctx)` → adapter `ServiceFn<N>`. */
function call<N extends CallableName>(
  name: N,
  service: (input: ReqOf<N>, ctx: ServicesAuthContext) => Promise<ResOf<N>>
) {
  return makeCallable(name, service as unknown as ServiceFn<N>);
}

/** Re-type the adapter `SystemContext` (minimal port) as the services
 *  `SystemContext` (rich port) at the trigger/scheduler/task ctx seam. */
const sysCtx = (ctx: AdapterSystemContext): ServicesSystemContext =>
  ctx as unknown as ServicesSystemContext;

// ─────────────────────────────────────────────────────────────────────────────
// Callables (contract name → @levelup/services service fn)
// ─────────────────────────────────────────────────────────────────────────────

export const saveExam = call("v1.autograde.saveExam", services.saveExamService);
export const saveExamQuestion = call(
  "v1.autograde.saveExamQuestion",
  services.saveExamQuestionService
);
export const extractQuestions = call(
  "v1.autograde.extractQuestions",
  services.extractQuestionsService
);
export const uploadAnswerSheets = call(
  "v1.autograde.uploadAnswerSheets",
  services.uploadAnswerSheetsService
);
export const requestUploadUrl = call(
  "v1.autograde.requestUploadUrl",
  services.requestUploadUrlService
);
export const gradeQuestion = call("v1.autograde.gradeQuestion", services.gradeQuestionService);
export const releaseResults = call("v1.autograde.releaseResults", services.releaseResultsService);
export const createSpaceFromExam = call(
  "v1.autograde.createSpaceFromExam",
  services.createSpaceFromExamService
);
export const saveEvaluationSettings = call(
  "v1.autograde.saveEvaluationSettings",
  services.saveEvaluationSettingsService
);
export const resolveDeadLetter = call(
  "v1.autograde.resolveDeadLetter",
  services.resolveDeadLetterService
);

// reads
export const listExams = call("v1.autograde.listExams", services.listExamsService);
export const getExam = call("v1.autograde.getExam", services.getExamService);
export const listQuestions = call("v1.autograde.listQuestions", services.listQuestionsService);
export const listSubmissions = call(
  "v1.autograde.listSubmissions",
  services.listSubmissionsService
);
export const getSubmission = call("v1.autograde.getSubmission", services.getSubmissionService);
export const getSubmissionForExam = call(
  "v1.autograde.getSubmissionForExam",
  services.getSubmissionForExamService
);
export const listQuestionSubmissions = call(
  "v1.autograde.listQuestionSubmissions",
  services.listQuestionSubmissionsService
);
export const getExamAnalytics = call(
  "v1.autograde.getExamAnalytics",
  // autograde-canonical read alias (the services barrel re-exports the autograde
  // read slice's `getExamAnalyticsService` as `getExamAnalyticsReadService` to
  // disambiguate from the analytics-fn-owned writer of the same projection).
  services.getExamAnalyticsReadService
);
export const listEvaluationSettings = call(
  "v1.autograde.listEvaluationSettings",
  services.listEvaluationSettingsService
);
export const listDeadLetter = call("v1.autograde.listDeadLetter", services.listDeadLetterService);
export const getEvaluationConfig = call(
  "v1.autograde.getEvaluationConfig",
  services.getAutogradeEvaluationConfigService
);

// ─────────────────────────────────────────────────────────────────────────────
// Triggers (thin firestore-event → service-event adapters)
//
// The adapter's `TriggerEvent` carries `{ type, params, before, after, id }`; the
// `@levelup/services` trigger contract wants `{ params, before, after, tenantId,
// eventId }` (tenantId resolved from the doc path, eventId = the doc id). This
// helper bridges the two shapes; the service stays the single source of behaviour.
// ─────────────────────────────────────────────────────────────────────────────

/** Build the `@levelup/services` `TriggerEvent` from the adapter event + ctx. */
function toServiceEvent<T extends Record<string, unknown>>(
  event: AdapterTriggerEvent<T>,
  ctx: AdapterSystemContext
): ServiceTriggerEvent<T> {
  return {
    params: event.params,
    before: event.before,
    after: event.after,
    tenantId: String(ctx.tenantId ?? event.params["tenantId"] ?? ""),
    eventId: event.id,
  };
}

/**
 * The pipeline stores questionSubmissions FLAT in the `submissions` collection
 * with a `_kind: 'questionSubmission'` discriminator (see services
 * `process-answer-mapping.ts` / `repos.submissions` usage) — there is NO nested
 * `questionSubmissions/` subcollection. All three submission-collection triggers
 * therefore share ONE document path and dispatch on `_kind`.
 */
const QUESTION_SUBMISSION_KIND = "questionSubmission";

/** The `_kind` discriminator of the doc the event fired on (before-or-after). */
export function eventDocKind(event: AdapterTriggerEvent<Record<string, unknown>>): unknown {
  return event.after?.["_kind"] ?? event.before?.["_kind"];
}

/** Submission created → start the grading pipeline (guarded inside the service). */
export const onSubmissionCreated = makeTrigger<Record<string, unknown>>(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    eventType: "created",
    tenantParam: "tenantId",
  },
  async (event, ctx) => {
    if (eventDocKind(event) === QUESTION_SUBMISSION_KIND) return; // flat sibling, not a submission
    await services.onSubmissionCreatedService(toServiceEvent(event, ctx), sysCtx(ctx));
  }
);

/** Submission pipelineStatus changed → the SINGLE reducer re-drives. */
export const onSubmissionUpdated = makeTrigger<Record<string, unknown>>(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  async (event, ctx) => {
    if (eventDocKind(event) === QUESTION_SUBMISSION_KIND) return; // flat sibling, not a submission
    await services.onSubmissionUpdatedService(toServiceEvent(event, ctx), sysCtx(ctx));
  }
);

/**
 * QuestionSubmission updated → enqueue an aggregate pipeline finalize check.
 * P1-G: registered on the FLAT `submissions` collection (where the pipeline
 * actually writes questionSubmission docs) and filtered on `_kind` — the old
 * nested `…/submissions/{s}/questionSubmissions/{q}` path never receives events.
 */
export const onQuestionSubmissionUpdated = makeTrigger<Record<string, unknown>>(
  {
    document: "tenants/{tenantId}/submissions/{questionSubmissionId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  async (event, ctx) => {
    if (eventDocKind(event) !== QUESTION_SUBMISSION_KIND) return; // real submissions handled above
    await services.onQuestionSubmissionUpdatedService(toServiceEvent(event, ctx), sysCtx(ctx));
  }
);

/** Exam published → reliable (outbox-backed) notification fan-out. */
export const onExamPublished = makeTrigger<Record<string, unknown>>(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  (event, ctx) => services.onExamPublishedService(toServiceEvent(event, ctx), sysCtx(ctx))
);

/** Exam results released → notification fan-out (students/parents/teacher). */
export const onResultsReleased = makeTrigger<Record<string, unknown>>(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  (event, ctx) => services.onResultsReleasedService(toServiceEvent(event, ctx), sysCtx(ctx))
);

/** Exam deleted → cascade-delete questions/submissions/analytics/DLQ. */
export const onExamDeleted = makeTrigger<Record<string, unknown>>(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "deleted",
    tenantParam: "tenantId",
  },
  (event, ctx) => services.onExamDeletedService(toServiceEvent(event, ctx), sysCtx(ctx))
);

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Tasks pipeline reducer (single-writer advance step) + DLQ on exhaustion.
// The grading-pipeline queue payload is `{ submissionId, step }` (see functions-
// shared `enqueuePipelineAdvance`); `advancePipelineService` is the reducer.
// ─────────────────────────────────────────────────────────────────────────────

/** Grading-pipeline reducer steps (mirrors `advancePipelineService`'s `PipelineStep`). */
type PipelineStep = "scouting" | "grading" | "finalize";

interface PipelineTaskPayload extends Record<string, unknown> {
  /** Rides every enqueue (functions-shared `enqueuePipelineAdvance`) so the
   *  handler rebuilds a tenant-scoped SystemContext (`tenantField: 'tenantId'`). */
  tenantId: string | null;
  submissionId: string;
  step: PipelineStep;
}

export const advancePipeline = makeTaskHandler<PipelineTaskPayload>(
  QUEUES.gradingPipeline,
  (payload, ctx) =>
    services.advancePipelineService(
      { submissionId: payload.submissionId, step: payload.step },
      sysCtx(ctx)
    ),
  {
    tenantField: "tenantId",
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 10 },
    rateLimits: { maxConcurrentDispatches: 6 },
    // The grading step evaluates every question of a submission sequentially
    // (one Pro call each), and scouting fans out one call per answer-sheet page —
    // both blow past the 60s default and 504. 9 min covers a full submission.
    timeoutSeconds: 540,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Schedulers
//
// The stale-submission watchdog re-drives in-flight submissions stuck past the
// staleness threshold. The service is per-tenant (`{ tenantId }` input); the
// scheduler fans out across tenants. `makeScheduler` builds a tenant-null
// SystemContext, so the THIN wrapper enumerates tenants and re-scopes the ctx —
// the only fan-out plumbing here; the re-drive logic stays in the service.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-tenant fan-out over a platform-wide scheduler service `({tenantId}, ctx)`.
 * Platform-wide tenant enumeration reads the `__platform__` registry collection
 * (`tenants/__platform__/tenants`), the same convention `@levelup/services`
 * identity/analytics schedulers use (`ctx.repos.tenants.list('__platform__', …)`).
 */
async function fanOutPerTenant(
  ctx: ServicesSystemContext,
  service: (input: { tenantId: string }, tenantCtx: ServicesSystemContext) => Promise<void>
): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.tenants.list("__platform__", { cursor, limit: 200 });
    for (const tenant of page.items) {
      const tenantId = String(tenant.id);
      const tenantCtx: ServicesSystemContext = { ...ctx, tenantId };
      await service({ tenantId }, tenantCtx);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}

/**
 * Stale-submission watchdog — re-drives in-flight submissions stuck past the
 * staleness threshold; escalates to manual-review + DLQ after N retries (every
 * 15 min). Per-tenant service fanned out platform-wide.
 */
export const staleSubmissionWatchdog = makeScheduler("every 15 minutes", (ctx) =>
  fanOutPerTenant(sysCtx(ctx), services.staleSubmissionWatchdogService)
);
