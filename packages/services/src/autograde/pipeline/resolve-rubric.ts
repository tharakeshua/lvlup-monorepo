/**
 * `resolveRubricService` — rubric inheritance resolution (autograde.md §"Pipeline";
 * spec §0 resolve-and-store). Resolution chain tenant → exam → question. The
 * resolved snapshot is stored on the question at extraction time; grading reads
 * the snapshot and re-reads the exam's `EvaluationSettings` for the ⚷ thresholds
 * AND the enabled output dimensions (AI-EVALUATION-CORE-PLAN.md Phase 3).
 * Returns `{ rubric, confidenceConfig, settings }`.
 *
 * Settings read from the DEDICATED `evaluationSettings` collection (the
 * `saveEvaluationSettings` writer) with the legacy tenants-repo location as a
 * fallback — the old tenants-only read silently missed every settings doc the
 * v1 writer produced, so thresholds/dimensions always fell back to defaults.
 */
import type { AuthContext } from "../../shared/context.js";
import { getEvaluationSettings, getDefaultEvaluationSettings } from "../../evaluation/resolve.js";

export interface ResolvedRubric {
  rubric: Record<string, unknown> | null;
  confidenceConfig: Record<string, unknown> | null;
  /** Full EvaluationSettings doc (enabledDimensions etc.), or null. */
  settings: Record<string, unknown> | null;
}

export async function resolveRubricService(
  ctx: AuthContext,
  tenantId: string,
  exam: Record<string, unknown>,
  question: Record<string, unknown>
): Promise<ResolvedRubric> {
  // Question carries the resolved snapshot (stored at extraction).
  const rubric = (question["rubric"] as Record<string, unknown> | undefined) ?? null;

  // ⚷ thresholds + output dimensions come from the exam's evaluationSettings.
  // Canonical reader precedence (U1.3): top-level `evaluationSettingsId` wins, but
  // legacy exams populated only the now-@deprecated nested `gradingConfig.*` — fall
  // back to it so those exams still resolve their thresholds. NEVER write the nested
  // one. When the exam names no settings, the tenant DEFAULT settings apply.
  const gradingConfig = exam["gradingConfig"] as Record<string, unknown> | undefined;
  const settingsId =
    (exam["evaluationSettingsId"] as string | undefined) ??
    (gradingConfig?.["evaluationSettingsId"] as string | undefined);
  let settings: Record<string, unknown> | null = null;
  try {
    settings = settingsId
      ? await getEvaluationSettings(ctx, tenantId, settingsId)
      : await getDefaultEvaluationSettings(ctx, tenantId);
  } catch {
    settings = null;
  }

  let confidenceConfig =
    (settings?.["confidenceConfig"] as Record<string, unknown> | undefined) ?? null;
  if (!confidenceConfig) {
    confidenceConfig = {
      confidenceThreshold: 0.7,
      autoApproveThreshold: 0.9,
      requireReviewForPartialCredit: true,
    };
  }
  return { rubric, confidenceConfig, settings };
}
