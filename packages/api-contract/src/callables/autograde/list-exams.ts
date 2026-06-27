/**
 * `v1.autograde.listExams` — paginated exam list (replaces direct Firestore reads).
 * Filter is server-scoped to the caller's tenant + role `classIds`. No `tenantId`
 * (D2). Read tier.
 */
import { z } from "zod";
import { zObject, zExamStatus, zClassId, zAcademicSessionId, zSpaceId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { pageResponse } from "../../pagination.js";
import { zPageParamsShape, ExamListViewSchema } from "./_shared.js";

export const ListExamsFilterSchema = zObject({
  status: zExamStatus.optional(),
  classId: zClassId.optional(),
  academicSessionId: zAcademicSessionId.optional(),
  subject: z.string().optional(),
  linkedSpaceId: zSpaceId.optional(),
});
export type ListExamsFilter = z.infer<typeof ListExamsFilterSchema>;

export const ListExamsRequestSchema = zObject({
  ...zPageParamsShape,
  filter: ListExamsFilterSchema.optional(),
});
export type ListExamsRequest = z.infer<typeof ListExamsRequestSchema>;

export const ListExamsResponseSchema = pageResponse(ExamListViewSchema);
export type ListExamsResponse = z.infer<typeof ListExamsResponseSchema>;

export const listExamsDef = {
  name: "v1.autograde.listExams",
  module: "autograde",
  requestSchema: ListExamsRequestSchema,
  responseSchema: ListExamsResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<ListExamsRequest, ListExamsResponse>;
