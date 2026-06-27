/**
 * v1.analytics.listLinkedChildren — parent read; collapses the old per-child
 * fan-out. Reads from `parentLinkedStudentIds` claim, not body (D10). Paginated.
 * Plan: §2.6 L93, common-api §156.
 */
import { z } from "zod";
import { defineCallable } from "../../callable-def.js";
import { PageRequest, pageResponse } from "../../pagination.js";
import { LinkedChildRowSchema } from "./_schemas.js";

export const ListLinkedChildrenRequestSchema = PageRequest;
export type ListLinkedChildrenRequest = z.infer<typeof ListLinkedChildrenRequestSchema>;

export const ListLinkedChildrenResponseSchema = pageResponse(LinkedChildRowSchema);
export type ListLinkedChildrenResponse = z.infer<typeof ListLinkedChildrenResponseSchema>;

export const listLinkedChildren = defineCallable({
  name: "v1.analytics.listLinkedChildren",
  module: "analytics",
  requestSchema: ListLinkedChildrenRequestSchema,
  responseSchema: ListLinkedChildrenResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
