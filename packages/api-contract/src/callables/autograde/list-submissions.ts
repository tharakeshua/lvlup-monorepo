/**
 * `v1.autograde.listSubmissions` — paginated submissions for an exam. Server
 * pre-joins `studentName`/`rollNumber`/`classId` (N+1 collapse) and enforces the
 * `resultsReleased` gate for student/parent + role scoping. The `uploadedBy` /
 * `resultsReleasedOnly` filters are supported. No `tenantId` (D2). Read tier.
 */
import { z } from "zod";
import {
  zObject,
  zExamId,
  zClassId,
  zStudentId,
  zUserId,
  zSubmissionPipelineStatus,
} from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { pageResponse } from "../../pagination.js";
import { zPageParamsShape, SubmissionListViewSchema } from "./_shared.js";

export const ListSubmissionsFilterSchema = zObject({
  examId: zExamId,
  classId: zClassId.optional(),
  studentId: zStudentId.optional(),
  pipelineStatus: zSubmissionPipelineStatus.optional(),
  uploadedBy: zUserId.optional(),
  resultsReleasedOnly: z.boolean().optional(),
});
export type ListSubmissionsFilter = z.infer<typeof ListSubmissionsFilterSchema>;

export const ListSubmissionsRequestSchema = zObject({
  ...zPageParamsShape,
  filter: ListSubmissionsFilterSchema,
});
export type ListSubmissionsRequest = z.infer<typeof ListSubmissionsRequestSchema>;

export const ListSubmissionsResponseSchema = pageResponse(SubmissionListViewSchema);
export type ListSubmissionsResponse = z.infer<typeof ListSubmissionsResponseSchema>;

export const listSubmissionsDef = {
  name: "v1.autograde.listSubmissions",
  module: "autograde",
  requestSchema: ListSubmissionsRequestSchema,
  responseSchema: ListSubmissionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<ListSubmissionsRequest, ListSubmissionsResponse>;
