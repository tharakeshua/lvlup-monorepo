/**
 * v1.levelup.listSpaceReviews — paginated reviews for a store space.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { SpaceReviewSchema } from "./_shared.js";

export const ListSpaceReviewsRequestSchema = withPaging(z.object({ spaceId: z.string() }).strict());
export type ListSpaceReviewsRequest = z.infer<typeof ListSpaceReviewsRequestSchema>;

export const ListSpaceReviewsResponseSchema = pageResponse(SpaceReviewSchema);
export type ListSpaceReviewsResponse = z.infer<typeof ListSpaceReviewsResponseSchema>;

export const listSpaceReviewsDef = defineCallable<
  ListSpaceReviewsRequest,
  ListSpaceReviewsResponse
>({
  name: "v1.levelup.listSpaceReviews",
  module: "levelup",
  requestSchema: ListSpaceReviewsRequestSchema,
  responseSchema: ListSpaceReviewsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
