/**
 * v1.levelup.listStoreSpaces — paginated B2C store listings.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { withPaging, pageResponse } from "./_shared.js";

import { StoreSpaceListingSchema } from "./_shared.js";

export const ListStoreSpacesRequestSchema = withPaging(
  z.object({ subject: z.string().optional(), search: z.string().optional() }).strict()
);
export type ListStoreSpacesRequest = z.infer<typeof ListStoreSpacesRequestSchema>;

export const ListStoreSpacesResponseSchema = pageResponse(StoreSpaceListingSchema);
export type ListStoreSpacesResponse = z.infer<typeof ListStoreSpacesResponseSchema>;

export const listStoreSpacesDef = defineCallable<ListStoreSpacesRequest, ListStoreSpacesResponse>({
  name: "v1.levelup.listStoreSpaces",
  module: "levelup",
  requestSchema: ListStoreSpacesRequestSchema,
  responseSchema: ListStoreSpacesResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
