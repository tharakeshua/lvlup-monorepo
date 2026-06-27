/**
 * v1.levelup.listSpaces — paginated, filtered list of SpaceViews (replaces direct
 * Firestore reads in student/teacher/parent UI).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { SpaceViewSchema, zSpaceStatus, zSpaceType } from "./_shared.js";

export const SpaceFilterSchema = z
  .object({
    status: zSpaceStatus.optional(),
    type: zSpaceType.optional(),
    classId: z.string().optional(),
    subject: z.string().optional(),
    teacherId: z.string().optional(),
  })
  .strict();

export const ListSpacesRequestSchema = withPaging(SpaceFilterSchema);
export type ListSpacesRequest = z.infer<typeof ListSpacesRequestSchema>;

export const ListSpacesResponseSchema = pageResponse(SpaceViewSchema);
export type ListSpacesResponse = z.infer<typeof ListSpacesResponseSchema>;

export const listSpacesDef = defineCallable<ListSpacesRequest, ListSpacesResponse>({
  name: "v1.levelup.listSpaces",
  module: "levelup",
  requestSchema: ListSpacesRequestSchema,
  responseSchema: ListSpacesResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
