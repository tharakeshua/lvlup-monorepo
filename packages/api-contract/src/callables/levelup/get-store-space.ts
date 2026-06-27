/**
 * v1.levelup.getStoreSpace — single B2C store listing.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { StoreSpaceListingSchema } from "./_shared.js";

export const GetStoreSpaceRequestSchema = z.object({ spaceId: z.string() }).strict();
export type GetStoreSpaceRequest = z.infer<typeof GetStoreSpaceRequestSchema>;

export const GetStoreSpaceResponseSchema = z.object({ listing: StoreSpaceListingSchema }).strict();
export type GetStoreSpaceResponse = z.infer<typeof GetStoreSpaceResponseSchema>;

export const getStoreSpaceDef = defineCallable<GetStoreSpaceRequest, GetStoreSpaceResponse>({
  name: "v1.levelup.getStoreSpace",
  module: "levelup",
  requestSchema: GetStoreSpaceRequestSchema,
  responseSchema: GetStoreSpaceResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
