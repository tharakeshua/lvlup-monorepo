/**
 * v1.levelup.getItemForEdit — ⚷ authoring-only re-merge of the AnswerKey back into
 * the item payload. Returns answer-bearing data; gated strictly to authoring roles
 * server-side and cached under an isolated non-persisted key (SDK-SERVER §7.1.3).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { ItemEditViewSchema } from "./_shared.js";

export const GetItemForEditRequestSchema = z
  .object({ spaceId: z.string(), storyPointId: z.string(), itemId: z.string() })
  .strict();
export type GetItemForEditRequest = z.infer<typeof GetItemForEditRequestSchema>;

export const GetItemForEditResponseSchema = z.object({ item: ItemEditViewSchema }).strict();
export type GetItemForEditResponse = z.infer<typeof GetItemForEditResponseSchema>;

export const getItemForEditDef = defineCallable<GetItemForEditRequest, GetItemForEditResponse>({
  name: "v1.levelup.getItemForEdit",
  module: "levelup",
  requestSchema: GetItemForEditRequestSchema,
  responseSchema: GetItemForEditResponseSchema,
  authMode: "authed",
  rateTier: "read",
  authoritySensitive: true,
});
