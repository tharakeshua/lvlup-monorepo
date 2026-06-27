/**
 * v1.levelup.saveSpaceReview — upsert the caller's 1–5 review for a store space.
 * The rating aggregate is ⚷ trigger-recomputed; this just writes the review.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";

export const SaveSpaceReviewRequestSchema = z
  .object({
    spaceId: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
  })
  .strict();
export type SaveSpaceReviewRequest = z.infer<typeof SaveSpaceReviewRequestSchema>;

export const SaveSpaceReviewResponseSchema = z
  .object({
    success: z.boolean(),
    isUpdate: z.boolean(),
  })
  .strict();
export type SaveSpaceReviewResponse = z.infer<typeof SaveSpaceReviewResponseSchema>;

export const saveSpaceReviewDef = defineCallable<SaveSpaceReviewRequest, SaveSpaceReviewResponse>({
  name: "v1.levelup.saveSpaceReview",
  module: "levelup",
  requestSchema: SaveSpaceReviewRequestSchema,
  responseSchema: SaveSpaceReviewResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["reviews", "spaces"],
});
