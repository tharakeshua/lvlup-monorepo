/**
 * v1.autograde.gradingStatus — live pipeline status for a submission.
 *
 * Projection doc `tenants/{t}/.../submissions/{id}/live` written by advancePipeline /
 * finalizeSubmission.
 *
 * **RELEASE-GATE (MERGE-REALTIME-AUTHORITY).** `SubmissionStatusSchema` deliberately
 * DROPS `summary` / `totalScore` / `grade` / `percentage`. A student subscriber sees
 * only pipeline progress; the actual score/grade is surfaced ONLY through the
 * `getSubmission` callable AFTER `resultsReleased`. No score field may ever ride this
 * live channel.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (gradingStatus row) / api-contract-core §7.2.
 */
import { z } from "zod";
import { zObject, zSubmissionPipelineStatus, GradingProgressSchema } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/**
 * `{pipelineStatus, gradingProgress, updatedAt}` — slim status projection.
 * NO summary / totalScore / grade / percentage (release-gated).
 */
export const SubmissionStatusSchema = zObject({
  pipelineStatus: zSubmissionPipelineStatus,
  gradingProgress: GradingProgressSchema.optional(),
  updatedAt: z.string(),
});
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const GradingStatusParamsSchema = zObject({ submissionId: z.string() });
export type GradingStatusParams = z.infer<typeof GradingStatusParamsSchema>;

export const gradingStatus = defineSubscription({
  name: "v1.autograde.gradingStatus",
  module: "autograde",
  source: "firestore-doc",
  params: GradingStatusParamsSchema,
  payload: SubmissionStatusSchema,
});
