/**
 * `resolveRubricService` — rubric inheritance resolution (autograde.md §"Pipeline";
 * spec §0 resolve-and-store). Resolution chain tenant → exam → question. The
 * resolved snapshot is stored on the question at extraction time; grading reads
 * the snapshot and only re-reads `EvaluationSettings` for the ⚷ thresholds (which
 * stay server-side). Returns `{ rubric, confidenceConfig }`.
 */
import type { AuthContext } from "../../shared/context.js";

export interface ResolvedRubric {
  rubric: Record<string, unknown> | null;
  confidenceConfig: Record<string, unknown> | null;
}

export async function resolveRubricService(
  ctx: AuthContext,
  tenantId: string,
  exam: Record<string, unknown>,
  question: Record<string, unknown>
): Promise<ResolvedRubric> {
  // Question carries the resolved snapshot (stored at extraction).
  const rubric = (question["rubric"] as Record<string, unknown> | undefined) ?? null;

  // ⚷ thresholds come from the exam's evaluationSettings (server-only).
  let confidenceConfig: Record<string, unknown> | null = null;
  const settingsId = exam["evaluationSettingsId"] as string | undefined;
  if (settingsId) {
    const settings = await ctx.repos.tenants.get(tenantId, settingsId);
    confidenceConfig =
      (settings?.["confidenceConfig"] as Record<string, unknown> | undefined) ?? null;
  }
  if (!confidenceConfig) {
    confidenceConfig = {
      confidenceThreshold: 0.7,
      autoApproveThreshold: 0.9,
      requireReviewForPartialCredit: true,
    };
  }
  return { rubric, confidenceConfig };
}
