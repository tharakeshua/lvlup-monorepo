/**
 * `v1.autograde.getExam` — single exam detail view. Tenant/role scoped server-side.
 * No `tenantId` (D2). Read tier.
 */
import { z } from "zod";
import { zObject, zExamId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { ExamDetailViewSchema } from "./_shared.js";

export const GetExamRequestSchema = zObject({
  id: zExamId,
});
export type GetExamRequest = z.infer<typeof GetExamRequestSchema>;

export const GetExamResponseSchema = ExamDetailViewSchema;
export type GetExamResponse = z.infer<typeof GetExamResponseSchema>;

export const getExamDef = {
  name: "v1.autograde.getExam",
  module: "autograde",
  requestSchema: GetExamRequestSchema,
  responseSchema: GetExamResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<GetExamRequest, GetExamResponse>;
