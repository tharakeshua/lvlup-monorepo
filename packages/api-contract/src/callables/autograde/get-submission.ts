/**
 * `v1.autograde.getSubmission` — single submission detail. Released-only for
 * student/parent; full for teacher (server enforces the `resultsReleased` gate +
 * student→own / parent→linked-children / teacher→classIds scoping). No `tenantId`
 * (D2). Read tier.
 */
import { z } from "zod";
import { zObject, zSubmissionId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { SubmissionDetailViewSchema } from "./_shared.js";

export const GetSubmissionRequestSchema = zObject({
  id: zSubmissionId,
});
export type GetSubmissionRequest = z.infer<typeof GetSubmissionRequestSchema>;

export const GetSubmissionResponseSchema = SubmissionDetailViewSchema;
export type GetSubmissionResponse = z.infer<typeof GetSubmissionResponseSchema>;

export const getSubmissionDef = {
  name: "v1.autograde.getSubmission",
  module: "autograde",
  requestSchema: GetSubmissionRequestSchema,
  responseSchema: GetSubmissionResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<GetSubmissionRequest, GetSubmissionResponse>;
