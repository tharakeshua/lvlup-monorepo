/**
 * v1.levelup.listVersions — paginated ContentVersion change-log for a space.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { ContentVersionSchema } from "./_shared.js";

export const ListVersionsRequestSchema = withPaging(z.object({ spaceId: z.string() }).strict());
export type ListVersionsRequest = z.infer<typeof ListVersionsRequestSchema>;

export const ListVersionsResponseSchema = pageResponse(ContentVersionSchema);
export type ListVersionsResponse = z.infer<typeof ListVersionsResponseSchema>;

export const listVersionsDef = defineCallable<ListVersionsRequest, ListVersionsResponse>({
  name: "v1.levelup.listVersions",
  module: "levelup",
  requestSchema: ListVersionsRequestSchema,
  responseSchema: ListVersionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
