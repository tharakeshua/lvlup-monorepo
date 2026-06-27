/**
 * v1.analytics.getAssignmentMatrix — optional class assignment tracker projection
 * (C12, §9.2). Per-class grid of assigned content × students with completion +
 * overdue status (server-derived). Teacher read. Plan: §9.2 C12.
 */
import { z } from "zod";
import { zObject, zClassId } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { AssignmentMatrixSchema } from "./_schemas.js";

export const GetAssignmentMatrixRequestSchema = zObject({
  classId: zClassId,
});
export type GetAssignmentMatrixRequest = z.infer<typeof GetAssignmentMatrixRequestSchema>;

export const GetAssignmentMatrixResponseSchema = AssignmentMatrixSchema;
export type GetAssignmentMatrixResponse = z.infer<typeof GetAssignmentMatrixResponseSchema>;

export const getAssignmentMatrix = defineCallable({
  name: "v1.analytics.getAssignmentMatrix",
  module: "analytics",
  requestSchema: GetAssignmentMatrixRequestSchema,
  responseSchema: GetAssignmentMatrixResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
