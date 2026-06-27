/**
 * `v1.autograde.listDeadLetter` — paginated grading DLQ entries. Teacher/admin only
 * (server-scoped). Filterable by `resolved` and `pipelineStep`. No `tenantId` (D2).
 * Read tier.
 */
import { z } from "zod";
import { zObject, GRADING_PIPELINE_STEPS } from "@levelup/domain";
import type { CallableDef } from "../../callable-def.js";
import { pageResponse } from "../../pagination.js";
import { zPageParamsShape, DeadLetterViewSchema } from "./_shared.js";

export const ListDeadLetterFilterSchema = zObject({
  resolved: z.boolean().optional(),
  pipelineStep: z.enum(GRADING_PIPELINE_STEPS).optional(),
});
export type ListDeadLetterFilter = z.infer<typeof ListDeadLetterFilterSchema>;

export const ListDeadLetterRequestSchema = zObject({
  ...zPageParamsShape,
  filter: ListDeadLetterFilterSchema.optional(),
});
export type ListDeadLetterRequest = z.infer<typeof ListDeadLetterRequestSchema>;

export const ListDeadLetterResponseSchema = pageResponse(DeadLetterViewSchema);
export type ListDeadLetterResponse = z.infer<typeof ListDeadLetterResponseSchema>;

export const listDeadLetterDef = {
  name: "v1.autograde.listDeadLetter",
  module: "autograde",
  requestSchema: ListDeadLetterRequestSchema,
  responseSchema: ListDeadLetterResponseSchema,
  authMode: "authed",
  rateTier: "read",
} as const satisfies CallableDef<ListDeadLetterRequest, ListDeadLetterResponse>;
