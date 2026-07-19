/** Tenant-scoped repair worker for durable conversation finalization stages. */
import type { ConversationSessionDoc, ItemSubmissionDoc } from "@levelup/domain";
import type { SystemContext } from "../shared/context.js";
import {
  continueConversationFinalization,
  type ConversationFinalizationState,
} from "./finalize.js";

export interface ResumeConversationFinalizationsOptions {
  /** Bounded per-tenant work; the repositories themselves also cap at 100. */
  limit?: number;
}

export interface ResumeConversationFinalizationsReport {
  examined: number;
  completed: number;
  pending: number;
  failed: number;
  errors: number;
}

/**
 * Platform-wide finalization repair. The scheduler shell builds a tenant-null
 * `SystemContext`, so this enumerates tenants from the prefix-aware tenant root
 * and fans out per tenant (LLD §13.2), spreading `{ ...ctx, tenantId }` for each.
 * A direct, tenant-scoped call (`ctx.tenantId` set) resumes only that tenant.
 * Per-tenant work never uses a collection-group or cross-root read.
 */
export async function resumeConversationFinalizationsService(
  ctx: SystemContext,
  options: ResumeConversationFinalizationsOptions = {}
): Promise<ResumeConversationFinalizationsReport> {
  if (ctx.tenantId) {
    return runTenantFinalizations(ctx, ctx.tenantId, options);
  }
  const report = emptyReport();
  const tenants = await ctx.repos.tenants.list("__platform__", { limit: 200 });
  for (const tenant of tenants.items) {
    const tenantId = String(tenant["id"]);
    try {
      accumulate(report, await runTenantFinalizations({ ...ctx, tenantId }, tenantId, options));
    } catch {
      // One unreadable/contended tenant must not starve the platform sweep.
      report.errors += 1;
    }
  }
  return report;
}

function emptyReport(): ResumeConversationFinalizationsReport {
  return { examined: 0, completed: 0, pending: 0, failed: 0, errors: 0 };
}

function accumulate(
  into: ResumeConversationFinalizationsReport,
  from: ResumeConversationFinalizationsReport
): void {
  into.examined += from.examined;
  into.completed += from.completed;
  into.pending += from.pending;
  into.failed += from.failed;
  into.errors += from.errors;
}

/** Resume a single tenant's durable finalization workflows. */
async function runTenantFinalizations(
  ctx: SystemContext,
  tenantId: string,
  options: ResumeConversationFinalizationsOptions = {}
): Promise<ResumeConversationFinalizationsReport> {
  const now = ctx.now();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const [sessions, recoverableSubmissions, retryableSubmissions] = await Promise.all([
    ctx.repos.conversations.listRecoveryCandidates(tenantId, now, limit),
    ctx.repos.itemSubmissions.listRecoveryCandidates(tenantId, now, limit),
    ctx.repos.itemSubmissions.listRetryable(tenantId, now, limit),
  ]);

  const candidates = new Map<
    string,
    { session?: ConversationSessionDoc; submission?: ItemSubmissionDoc }
  >();
  for (const session of sessions) candidates.set(String(session.id), { session });
  for (const submission of [...recoverableSubmissions, ...retryableSubmissions]) {
    const current = candidates.get(String(submission.sessionId)) ?? {};
    candidates.set(String(submission.sessionId), { ...current, submission });
  }

  const report: ResumeConversationFinalizationsReport = {
    examined: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    errors: 0,
  };
  const ordered = [...candidates.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, limit);
  for (const [sessionId, candidate] of ordered) {
    report.examined += 1;
    try {
      const session =
        candidate.session ?? (await ctx.repos.conversations.getSession(tenantId, sessionId));
      if (!session || session.status === "completed" || session.status === "abandoned") continue;

      // Active sessions with a stale *turn* belong to the turn recovery path,
      // not finalization.  The conversation repo deliberately shares its
      // recovery candidate index, so filter them before claiming a finalization.
      const hardLimit =
        session.status === "ready_to_finish" &&
        session.completionRecommendation?.hardLimitReached === true;
      if (!hardLimit && session.status === "active" && !candidate.submission) continue;

      const source = hardLimit ? "hard_limit" : "recovery";
      const state = await continueConversationFinalization(
        {
          tenantId,
          sessionId,
          // Stable across scheduler retries: it permits a restarted worker to
          // resume its own lease but cannot defeat another owner's fresh lease.
          ownerRequestId: `recovery:${sessionId}`,
          source,
        },
        ctx
      );
      classify(report, state);
    } catch {
      // One corrupt/contended workflow must not starve other tenant candidates.
      report.errors += 1;
    }
  }
  return report;
}

function classify(
  report: ResumeConversationFinalizationsReport,
  state: ConversationFinalizationState
): void {
  if (state.session.status === "completed") {
    report.completed += 1;
    return;
  }
  if (
    state.session.status === "grading_failed" ||
    state.submission?.workflow.status === "grading_failed"
  ) {
    report.failed += 1;
    return;
  }
  report.pending += 1;
}
