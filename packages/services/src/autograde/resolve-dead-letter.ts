/**
 * `resolveDeadLetterService` (autograde.md §"Command services"). Marks a grading
 * DLQ entry resolved with the operator's `method`:
 *   - `retry`        → re-enqueue the failed step (`retry_success`),
 *   - `manual_grade` → mark resolved via a manual override (`manual_grade`),
 *   - `dismiss`      → dismiss without grading (`dismissed`).
 * Idempotent (re-resolving a resolved entry is a no-op). `tenantId` from ctx.
 * DLQ entries are stored on the `outbox` repo with a `_kind:'gradingDeadLetter'`
 * discriminator (the real adapter uses a dedicated collection).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { enqueuePipelineAdvance } from "./pipeline/advance-pipeline.js";

type Req = ReqOf<"v1.autograde.resolveDeadLetter">;
type Res = ResOf<"v1.autograde.resolveDeadLetter">;

const METHOD_TO_RESOLUTION: Record<Req["method"], Res["resolution"]> = {
  retry: "retry_success",
  manual_grade: "manual_grade",
  dismiss: "dismissed",
};

export async function resolveDeadLetterService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "grade.retry", { tenantId });

  // SVC-4 / NEW-1: never drain-all — list + single-row update only.
  const entries = await ctx.repos.outbox.list(tenantId, { kind: "gradingDeadLetter" });
  const entry = entries.find((e) => e["id"] === input.entryId);
  if (!entry) fail("NOT_FOUND", `dead-letter entry ${input.entryId} not found`);

  // Idempotent: already resolved → no-op.
  if (entry["resolvedAt"]) {
    return { success: true, resolution: entry["resolutionMethod"] as Res["resolution"] } as Res;
  }

  const resolution = METHOD_TO_RESOLUTION[input.method];
  const now = ctx.now();

  if (input.method === "retry") {
    const submissionId = entry["submissionId"] as string;
    await enqueuePipelineAdvance(ctx, submissionId, "grading");
  }

  await ctx.repos.outbox.update(tenantId, input.entryId, {
    resolvedAt: now,
    resolvedBy: ctx.uid,
    resolutionMethod: resolution,
  });

  return { success: true, resolution } as Res;
}
