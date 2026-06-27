/**
 * `progressUpdater` — the SINGLE transactional progress writer (REVIEW §6.9 /
 * §5.3 MERGE-SINGLE-WRITER). Every per-item evaluation (test submit, evaluateAnswer,
 * recordItemAttempt) funnels through `ctx.repos.progress.update(...)`, which does
 * a read-modify-write on the aggregate doc inside ONE Firestore tx so N concurrent
 * AI-item completions serialize (Firestore aborts+retries on contention) and the
 * best-score-retention semantics hold.
 *
 * It sets the analytics recompute marker and does NOT sync the leaderboard inline
 * (leaderboard has exactly one downstream writer). `score`/`maxScore`/`correct`
 * are SERVER-computed; the client never sends them (CD13).
 */
import type { ProgressItemUpdate, ProgressUpdateResult } from "../repo-admin/types.js";
import type { AuthContext, SystemContext } from "../shared/context.js";

export interface ApplyProgressArgs {
  userId: string;
  spaceId: string;
  items: ProgressItemUpdate[];
  totalStoryPoints?: number;
}

/**
 * Apply one or more scored item contributions to a learner's space progress.
 * Wraps the single-writer repo call; the transaction + best-score retention live
 * in the admin adapter (`ProgressRepo.update`).
 */
export async function applyProgress(
  args: ApplyProgressArgs,
  ctx: AuthContext | SystemContext
): Promise<ProgressUpdateResult> {
  const tenantId = ctx.tenantId;
  if (!tenantId) throw new Error("progressUpdater requires a tenant on the context");
  return ctx.repos.progress.update(
    tenantId,
    {
      userId: args.userId,
      spaceId: args.spaceId,
      items: args.items,
      totalStoryPoints: args.totalStoryPoints,
    },
    ctx.now()
  );
}
