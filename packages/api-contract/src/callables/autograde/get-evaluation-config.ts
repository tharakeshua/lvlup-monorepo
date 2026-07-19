/**
 * v1.autograde.getEvaluationConfig — the RESOLVED grading config for one exam
 * question (or the exam-level defaults when `questionId` is omitted): the
 * question's rubric snapshot + the evaluation settings the RELMS grader will
 * use, with provenance. Shown on the exam/question editors and the grading
 * review screens ("this is exactly how the AI will score this question").
 *
 * ⚷ Same role projection as the levelup twin — rubric secrets, dimension
 * guidance, and confidence thresholds are authoring-only. Autograde runs
 * without an evaluator agent today, so `agent` is always null here (the field
 * exists so both configs render through one UI component).
 */
import { z } from "zod";
import { UnifiedRubricSchema, zObject } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { EvaluationSettingsViewSchema } from "./_shared.js";
import { AgentViewSchema } from "../levelup/_shared.js";
import { EvaluationConfigProvenanceSchema } from "../levelup/get-evaluation-config.js";

export const AutogradeEvaluationConfigViewSchema = zObject({
  agent: AgentViewSchema.nullable(),
  rubric: UnifiedRubricSchema.nullable(),
  settings: EvaluationSettingsViewSchema.nullable(),
  provenance: EvaluationConfigProvenanceSchema,
});
export type AutogradeEvaluationConfigView = z.infer<typeof AutogradeEvaluationConfigViewSchema>;

export const GetAutogradeEvaluationConfigRequestSchema = zObject({
  examId: z.string(),
  /** Omit to preview the exam-level defaults (exam settings screen). */
  questionId: z.string().optional(),
});
export type GetAutogradeEvaluationConfigRequest = z.infer<
  typeof GetAutogradeEvaluationConfigRequestSchema
>;

export const GetAutogradeEvaluationConfigResponseSchema = zObject({
  config: AutogradeEvaluationConfigViewSchema,
});
export type GetAutogradeEvaluationConfigResponse = z.infer<
  typeof GetAutogradeEvaluationConfigResponseSchema
>;

export const getAutogradeEvaluationConfigDef = {
  name: "v1.autograde.getEvaluationConfig",
  module: "autograde",
  requestSchema: GetAutogradeEvaluationConfigRequestSchema,
  responseSchema: GetAutogradeEvaluationConfigResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<
  GetAutogradeEvaluationConfigRequest,
  GetAutogradeEvaluationConfigResponse
>;
