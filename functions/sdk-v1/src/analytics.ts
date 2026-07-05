/**
 * `v1.analytics.*` callable / trigger / scheduler / task wiring (per
 * SDK-LAYERS-PLAN §2.6; analytics triggers/schedulers per §5.3). THIN shells over
 * `@levelup/services` — no business logic lives here. Runtime ports
 * (repos/ai/clock) are injected by `./bootstrap` (imported first in index.ts); do
 * NOT re-wire them here.
 *
 * Each `export const <op>` becomes a property of the nested `v1.analytics` group
 * in index.ts, so its deployed/emulator id is `v1-analytics-<op>` and the dotted
 * contract name `v1.analytics.<op>` maps to it (see index.ts header).
 *
 * ── services-barrel collisions (analytics-canonical twins) ──
 * Four analytics capabilities collide by name with the levelup slice
 * (`dismissInsight`, `getLeaderboard`, `updateLeaderboard`, the merged
 * `onSpaceProgressUpdated`); the services barrel re-exports the analytics-canonical
 * versions under `*AnalyticsService`-suffixed names. We wire those here; the
 * levelup module wires its own twins.
 *
 * ── T9 / structural-port-seam casts (the SINGLE sanctioned boundary) ──
 * A `@levelup/services` service/trigger/scheduler fn is typed against the services
 * `AuthContext`/`SystemContext`, whose `repos` is the RICH `repo-admin` `Repos`.
 * The adapter shells (`makeCallable`/`makeTrigger`/`makeScheduler`/`makeTaskHandler`)
 * type `ctx` against the deliberately-minimal structural `Repos` port
 * (`context/ports.ts`). The concrete runtime injects the rich repos (bootstrap.ts),
 * so the two contexts are structurally reconcilable but nominally distinct ONLY at
 * the `repos` port. The `call`/`trigger`/`schedule`/`task` helpers below confine the
 * ctx cast to this one wiring boundary (the symmetric twin of bootstrap.ts's
 * injection cast and of levelup.ts's `call`/`schedule`). Input/output stay FULLY
 * contract-checked via `ReqOf`/`ResOf`; no `any`; no test weakening.
 *
 * ── Backing-service coverage (Phase 5, TRACK A · STEP 2) ──
 * Three api-contract analytics callables have NO backing service fn in
 * `@levelup/services` and produce distinct paged response shapes (so wiring them to
 * any existing analytics service would be response drift / invented behaviour):
 *   - v1.analytics.listParentAlerts     → pageResponse(ParentAlertSchema)
 *   - v1.analytics.listPlatformActivity → pageResponse(PlatformActivityLogSchema)
 *   - v1.analytics.getAssignmentMatrix  → GetAssignmentMatrixResponseSchema
 * Per the wiring contract we do NOT invent business logic for them; they remain
 * unexported here (registered in the contract, no server brain yet) and are listed
 * in the STEP-2 return.
 */
import {
  makeCallable,
  makeScheduler,
  makeTrigger,
  makeTaskHandler,
  QUEUES,
  type ServiceFn,
  type SchedulerService,
  type TriggerService,
  type TriggerRef,
  type TaskService,
  type TaskHandlerOpts,
} from "@levelup/functions-adapters";
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import type {
  AuthContext as ServicesAuthContext,
  SystemContext as ServicesSystemContext,
  TriggerEvent as ServicesTriggerEvent,
} from "@levelup/services";
import {
  // reads / shared
  getSummaryService,
  getExamAnalyticsService,
  listInsightsService,
  getPerformanceTrendsService,
  getChildSummaryService,
  listLinkedChildrenService,
  listParentAlertsService,
  listPlatformActivityService,
  getCostSummaryService,
  getAssignmentMatrixService,
  // report
  generateReportService,
  // analytics-canonical twins (disambiguated names — see header)
  dismissInsightAnalyticsService,
  getLeaderboardAnalyticsService,
  // triggers
  onSubmissionGradedService,
  onSpaceProgressUpdatedAnalyticsService,
  onExamResultsReleasedService,
  recomputeOrchestratorHandler,
  // schedulers (per-tenant `({tenantId}, ctx)`)
  dailyCostAggregationService,
  nightlyAtRiskDetectionService,
  generateInsightsScheduler,
} from "@levelup/services";

// ─────────────────────────────────────────────────────────────────────────────
// Wire helpers — the SINGLE sanctioned T9 ctx-seam cast (see header). Each casts
// ONLY the ctx port; request/response stay contract-checked.
// ─────────────────────────────────────────────────────────────────────────────

/** Callable wire: services `(input, ctx)` → adapter `ServiceFn<N>`. */
function call<N extends CallableName>(
  name: N,
  service: (input: ReqOf<N>, ctx: ServicesAuthContext) => Promise<ResOf<N>>
) {
  return makeCallable(name, service as unknown as ServiceFn<N>);
}

/** Firestore-trigger wire. Bridges the adapter event `{type,params,before,after,id}`
 *  to the services event `{params,before,after,tenantId,eventId}` (tenantId from the
 *  doc-path param, eventId = the doc id), then casts the ctx seam. */
function trigger(
  ref: TriggerRef,
  service: (event: ServicesTriggerEvent, ctx: ServicesSystemContext) => Promise<void>
) {
  const bridged: TriggerService<Record<string, unknown>> = (event, ctx) =>
    service(
      {
        params: event.params,
        before: event.before,
        after: event.after,
        tenantId: String(ctx.tenantId ?? event.params["tenantId"] ?? ""),
        eventId: event.id,
      },
      ctx as unknown as ServicesSystemContext
    );
  return makeTrigger(ref, bridged);
}

/** Scheduler wire: a platform-wide `(ctx)` shell that fans out per tenant into the
 *  services scheduler `({tenantId}, ctx)`. The only fan-out plumbing here; the
 *  roll-up / detection / insight logic stays in the service. */
function schedule(
  spec: string,
  service: (input: { tenantId: string }, ctx: ServicesSystemContext) => Promise<void>
) {
  const platform: SchedulerService = async (ctx) => {
    const sysCtx = ctx as unknown as ServicesSystemContext;
    // Platform-wide tenant enumeration reads the `__platform__` registry
    // collection (`tenants/__platform__/tenants`) — the same convention the
    // `@levelup/services` identity/analytics schedulers use. `EntityRepo.list`
    // is `(tenantId, opts)`; the platform registry tenantId is `'__platform__'`.
    const tenantsRepo = sysCtx.repos.tenants as unknown as {
      list(
        tenantId: string,
        opts: { cursor?: string; limit?: number }
      ): Promise<{
        items: { id: string }[];
        nextCursor?: string | null;
      }>;
    };
    let cursor: string | undefined;
    do {
      const page = await tenantsRepo.list("__platform__", { cursor, limit: 200 });
      for (const tenant of page.items) {
        const tenantId = String(tenant.id);
        const tenantCtx = { ...sysCtx, tenantId } as ServicesSystemContext;
        await service({ tenantId }, tenantCtx);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  };
  return makeScheduler(spec, platform);
}

/** Cloud Tasks wire: services `(payload, ctx)` → adapter `TaskService<P>`. */
function task<P extends Record<string, unknown>>(
  queue: (typeof QUEUES)[keyof typeof QUEUES],
  service: (payload: P, ctx: ServicesSystemContext) => Promise<void>,
  opts: TaskHandlerOpts = {}
) {
  return makeTaskHandler<P>(queue, service as unknown as TaskService<P>, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Callables (contract name → @levelup/services service fn)
// ─────────────────────────────────────────────────────────────────────────────

// reads / shared
export const getSummary = call("v1.analytics.getSummary", getSummaryService);
export const getExamAnalytics = call("v1.analytics.getExamAnalytics", getExamAnalyticsService);
export const listInsights = call("v1.analytics.listInsights", listInsightsService);
export const getPerformanceTrends = call(
  "v1.analytics.getPerformanceTrends",
  getPerformanceTrendsService
);
export const getChildSummary = call("v1.analytics.getChildSummary", getChildSummaryService);
export const listLinkedChildren = call(
  "v1.analytics.listLinkedChildren",
  listLinkedChildrenService
);
export const listParentAlerts = call("v1.analytics.listParentAlerts", listParentAlertsService);
export const listPlatformActivity = call(
  "v1.analytics.listPlatformActivity",
  listPlatformActivityService
);
export const getCostSummary = call("v1.analytics.getCostSummary", getCostSummaryService);
export const getAssignmentMatrix = call(
  "v1.analytics.getAssignmentMatrix",
  getAssignmentMatrixService
);

// report (PDF/CSV generation)
export const generateReport = call("v1.analytics.generateReport", generateReportService);

// analytics-canonical twins (services-barrel disambiguated names — see header)
export const dismissInsight = call("v1.analytics.dismissInsight", dismissInsightAnalyticsService);
export const getLeaderboard = call("v1.analytics.getLeaderboard", getLeaderboardAnalyticsService);

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

/** Submission transitioned into a graded pipelineStatus → recompute the student's
 *  autograde section (single-writer) + enqueue the recompute orchestrator. */
export const onSubmissionGraded = trigger(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  onSubmissionGradedService
);

/** Space progress written → recompute the student's levelup section + the
 *  leaderboard story-point diff (the MERGED trigger; analytics-canonical twin). */
export const onSpaceProgressUpdated = trigger(
  {
    document: "tenants/{tenantId}/spaceProgress/{progressId}",
    eventType: "written",
    tenantParam: "tenantId",
  },
  onSpaceProgressUpdatedAnalyticsService
);

/** Exam status → results_released → recompute exam analytics (single-writer per
 *  doc) + outbox results-released notification. */
export const onExamResultsReleased = trigger(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    eventType: "updated",
    tenantParam: "tenantId",
  },
  onExamResultsReleasedService
);

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Tasks: the single RecomputeMarker consumer (the 4-writer fan-out collapse).
// Enqueued onto the `student-rollup` queue by the trigger services; the handler is
// thin over `recomputeOrchestratorHandler` `(payload, ctx)`.
// ─────────────────────────────────────────────────────────────────────────────

interface RecomputeRollupPayload extends Record<string, unknown> {
  tenantId: string;
  studentId: string;
  marker?: { reason: string; requestedAt: string; taskId?: string };
}

export const recomputeStudentRollup = task<RecomputeRollupPayload>(
  QUEUES.studentRollup,
  (payload, ctx) =>
    recomputeOrchestratorHandler(
      { tenantId: payload.tenantId, studentId: payload.studentId, marker: payload.marker },
      ctx
    ),
  {
    tenantField: "tenantId",
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 10 },
    rateLimits: { maxConcurrentDispatches: 6 },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Schedulers (per-tenant fan-out; cron in UTC)
// ─────────────────────────────────────────────────────────────────────────────

/** Daily LLM-cost monthly roll-up + budget alert (00:05 UTC). */
export const dailyCostAggregation = schedule("5 0 * * *", dailyCostAggregationService);

/** Nightly at-risk detection — paginated, sets flags only (02:00 daily). */
export const nightlyAtRiskDetection = schedule("0 2 * * *", nightlyAtRiskDetectionService);

/** Per-student insight generation — fixed 5-active cap (02:30 daily). */
export const generateInsights = schedule("30 2 * * *", generateInsightsScheduler);
