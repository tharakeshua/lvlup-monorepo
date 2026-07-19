/**
 * `v1.autograde.createSpaceFromExam` — teacher action (EXAM-SPACE-INTEGRATION MVP
 * §A/§B) that transforms a published exam into a learning Space: one StoryPoint
 * representing the exam, and one Item per extracted question (best-effort
 * question-type mapping). Idempotent: re-invoking on an exam that already carries
 * `linkedSpaceId`/`linkedStoryPointId` returns the existing ids rather than
 * creating a duplicate space (the exam → space link is intentionally 1:1).
 *
 * No `tenantId` in the request (D2). Authority-sensitive: it writes a Space,
 * StoryPoint, N Items, and patches the exam's link fields in one server verb.
 */
import { z } from "zod";
import { zObject, zExamId, zSpaceId, zStoryPointId } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";

export const CreateSpaceFromExamRequestSchema = zObject({
  examId: zExamId,
});
export type CreateSpaceFromExamRequest = z.infer<typeof CreateSpaceFromExamRequestSchema>;

export const CreateSpaceFromExamResponseSchema = zObject({
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  itemsCreated: z.number().int(),
  /** `false` when the exam was already linked and no new entities were created. */
  created: z.boolean(),
});
export type CreateSpaceFromExamResponse = z.infer<typeof CreateSpaceFromExamResponseSchema>;

export const createSpaceFromExamDef = {
  name: "v1.autograde.createSpaceFromExam",
  module: "autograde",
  requestSchema: CreateSpaceFromExamRequestSchema,
  responseSchema: CreateSpaceFromExamResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:examId",
  authoritySensitive: true,
  invalidates: ["exams", "spaces", "storyPoints", "items"],
} as const satisfies CallableDef<CreateSpaceFromExamRequest, CreateSpaceFromExamResponse>;
