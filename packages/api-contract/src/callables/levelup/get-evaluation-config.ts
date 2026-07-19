/**
 * v1.levelup.getEvaluationConfig — the RESOLVED evaluation config triad for one
 * item (or a space's defaults when `itemId` is omitted): evaluator agent, question
 * rubric, evaluation settings, plus WHERE each leg came from (provenance). The UI
 * shows this wherever grading is about to happen (item editor preview, learner
 * "how you'll be graded", review screens).
 *
 * ⚷ Server projects by role: non-authoring callers get the rubric without
 * modelAnswer/evaluatorGuidance/promptGuidance, the agent without
 * systemPrompt/rules/evaluationObjectives, and the settings without
 * confidenceConfig/promptGuidance. Authoring roles see everything.
 */
import { z } from "zod";
import { UnifiedRubricSchema } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { AgentViewSchema } from "./_shared.js";
import { EvaluationSettingsViewSchema } from "../autograde/_shared.js";

export const EvaluationConfigSourceSchema = z.enum([
  "item",
  "space",
  "exam",
  "tenant_default",
  "none",
]);
export type EvaluationConfigSource = z.infer<typeof EvaluationConfigSourceSchema>;

export const EvaluationConfigProvenanceSchema = z
  .object({
    agentSource: EvaluationConfigSourceSchema,
    rubricSource: EvaluationConfigSourceSchema,
    settingsSource: EvaluationConfigSourceSchema,
  })
  .strict();
export type EvaluationConfigProvenanceView = z.infer<typeof EvaluationConfigProvenanceSchema>;

export const EvaluationConfigViewSchema = z
  .object({
    agent: AgentViewSchema.nullable(),
    rubric: UnifiedRubricSchema.nullable(),
    settings: EvaluationSettingsViewSchema.nullable(),
    provenance: EvaluationConfigProvenanceSchema,
  })
  .strict();
export type EvaluationConfigView = z.infer<typeof EvaluationConfigViewSchema>;

export const GetEvaluationConfigRequestSchema = z
  .object({
    spaceId: z.string(),
    /** Omit to preview the space-level defaults (space settings screen). */
    itemId: z.string().optional(),
  })
  .strict();
export type GetEvaluationConfigRequest = z.infer<typeof GetEvaluationConfigRequestSchema>;

export const GetEvaluationConfigResponseSchema = z
  .object({ config: EvaluationConfigViewSchema })
  .strict();
export type GetEvaluationConfigResponse = z.infer<typeof GetEvaluationConfigResponseSchema>;

export const getEvaluationConfigDef = defineCallable<
  GetEvaluationConfigRequest,
  GetEvaluationConfigResponse
>({
  name: "v1.levelup.getEvaluationConfig",
  module: "levelup",
  requestSchema: GetEvaluationConfigRequestSchema,
  responseSchema: GetEvaluationConfigResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
