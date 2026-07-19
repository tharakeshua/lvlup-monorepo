/**
 * getEvaluationConfig (autograde) — the resolved grading config for one exam
 * question (rubric snapshot + the EvaluationSettings the RELMS grader will use)
 * or the exam-level defaults when `questionId` is omitted. Same view/projection
 * as the levelup twin (`agent` is null — autograde runs persona-less v-now).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { isAuthoringRole } from "../shared/projections.js";
import { resolveRubricService } from "./pipeline/resolve-rubric.js";
import { buildEvaluationConfigView } from "../evaluation/config-view.js";
import type { EvaluationConfigProvenance } from "../evaluation/types.js";

type Doc = Record<string, unknown>;

export async function getAutogradeEvaluationConfigService(
  input: ReqOf<"v1.autograde.getEvaluationConfig">,
  ctx: AuthContext
): Promise<ResOf<"v1.autograde.getEvaluationConfig">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.read", { examId: input.examId, tenantId });

  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail("NOT_FOUND", "exam not found");

  let question: Doc = { rubric: null };
  if (input.questionId) {
    const found = await ctx.repos.exams.get(tenantId, input.questionId);
    if (!found || found["_kind"] !== "examQuestion" || found["examId"] !== input.examId) {
      fail("NOT_FOUND", "exam question not found");
    }
    question = found;
  }

  const { rubric, settings } = await resolveRubricService(ctx, tenantId, exam, question);

  const gradingConfig = exam["gradingConfig"] as Doc | undefined;
  const examNamesSettings = Boolean(
    (exam["evaluationSettingsId"] as string | undefined) ??
    (gradingConfig?.["evaluationSettingsId"] as string | undefined)
  );
  const provenance: EvaluationConfigProvenance = {
    agentSource: "none",
    rubricSource: rubric ? "item" : "none",
    settingsSource: settings ? (examNamesSettings ? "exam" : "tenant_default") : "none",
  };

  const config = buildEvaluationConfigView({
    agent: null,
    rubric: rubric as Doc | null,
    settings: settings as Doc | null,
    provenance,
    tenantId,
    spaceId: "",
    authoring: isAuthoringRole(ctx),
  });
  return { config } as unknown as ResOf<"v1.autograde.getEvaluationConfig">;
}
