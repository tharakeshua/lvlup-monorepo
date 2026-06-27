/**
 * v1.levelup.purchaseSpace — B2C store purchase. The SDK may REQUEST a purchase but
 * never self-enrolls; the server runs the PaymentGateway and writes the
 * PurchaseRecord + consumerProfile enrollment (⚷). Idempotent; authoritySensitive;
 * NOT optimistic. v1 response contract is stable so the real gateway is a drop-in.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";

export const PurchaseSpaceRequestSchema = z
  .object({
    spaceId: z.string(),
    paymentToken: z.string().optional(),
  })
  .strict();
export type PurchaseSpaceRequest = z.infer<typeof PurchaseSpaceRequestSchema>;

export const PurchaseSpaceResponseSchema = z
  .object({
    success: z.boolean(),
    transactionId: z.string(),
    enrolledSpaceId: z.string(),
  })
  .strict();
export type PurchaseSpaceResponse = z.infer<typeof PurchaseSpaceResponseSchema>;

export const purchaseSpaceDef = defineCallable<PurchaseSpaceRequest, PurchaseSpaceResponse>({
  name: "v1.levelup.purchaseSpace",
  module: "levelup",
  requestSchema: PurchaseSpaceRequestSchema,
  responseSchema: PurchaseSpaceResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["store", "spaces", "enrollments"],
  authoritySensitive: true,
});
