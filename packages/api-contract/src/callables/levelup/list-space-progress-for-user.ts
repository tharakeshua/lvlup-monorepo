/**
 * v1.levelup.listSpaceProgressForUser — paginated SpaceProgressViews for a given
 * learner (parent dashboard). Parent gated via `progress.readOther` +
 * `studentId ∈ ctx.studentIds` server-side (SDK-LAYERS C17).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { SpaceProgressViewSchema } from "./_shared.js";

export const ListSpaceProgressForUserRequestSchema = withPaging(
  z.object({ userId: z.string() }).strict()
);
export type ListSpaceProgressForUserRequest = z.infer<typeof ListSpaceProgressForUserRequestSchema>;

export const ListSpaceProgressForUserResponseSchema = pageResponse(SpaceProgressViewSchema);
export type ListSpaceProgressForUserResponse = z.infer<
  typeof ListSpaceProgressForUserResponseSchema
>;

export const listSpaceProgressForUserDef = defineCallable<
  ListSpaceProgressForUserRequest,
  ListSpaceProgressForUserResponse
>({
  name: "v1.levelup.listSpaceProgressForUser",
  module: "levelup",
  requestSchema: ListSpaceProgressForUserRequestSchema,
  responseSchema: ListSpaceProgressForUserResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
