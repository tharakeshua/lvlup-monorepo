/**
 * v1.levelup.listTestSessions — paginated session summaries (no submissions).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { DigitalTestSessionSummaryViewSchema, zTestSessionStatus } from "./_shared.js";

export const ListTestSessionsRequestSchema = withPaging(
  z
    .object({
      spaceId: z.string().optional(),
      storyPointId: z.string().optional(),
      userId: z.string().optional(),
      status: zTestSessionStatus.optional(),
      latestOnly: z.boolean().optional(),
    })
    .strict()
);
export type ListTestSessionsRequest = z.infer<typeof ListTestSessionsRequestSchema>;

export const ListTestSessionsResponseSchema = pageResponse(DigitalTestSessionSummaryViewSchema);
export type ListTestSessionsResponse = z.infer<typeof ListTestSessionsResponseSchema>;

export const listTestSessionsDef = defineCallable<
  ListTestSessionsRequest,
  ListTestSessionsResponse
>({
  name: "v1.levelup.listTestSessions",
  module: "levelup",
  requestSchema: ListTestSessionsRequestSchema,
  responseSchema: ListTestSessionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
