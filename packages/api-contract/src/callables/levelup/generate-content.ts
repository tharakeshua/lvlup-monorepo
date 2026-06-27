/**
 * v1.levelup.generateContent — AI-gateway draft generation of items from a spec /
 * source PDF (SDK-LAYERS C13). Behind cost/quota/moderation. Returns DRAFTS only —
 * NO auto-persist; the accept step is `saveItem`. ai tier; not optimistic.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { ItemPayloadSchema, UnifiedRubricSchema, zQuestionType } from "./_shared.js";

/** GeneratedItem (ai-spec C8 §4.4) — a validated draft, payload is the discriminated union. */
export const GeneratedItemSchema = z
  .object({
    itemType: z.enum(["question", "material"]),
    questionType: zQuestionType.optional(),
    title: z.string(),
    payload: ItemPayloadSchema,
    bloomsLevel: z.string().optional(),
    topics: z.array(z.string()).optional(),
    suggestedRubric: UnifiedRubricSchema.optional(),
  })
  .strict();
export type GeneratedItem = z.infer<typeof GeneratedItemSchema>;

export const GenerateContentRequestSchema = z
  .object({
    storyPointId: z.string(),
    spaceId: z.string().optional(),
    spec: z
      .object({
        types: z.array(z.string()).min(1),
        count: z.number().int().min(1).max(50),
        difficulty: z.string().optional(),
      })
      .strict(),
    sourcePdfPath: z.string().optional(),
  })
  .strict();
export type GenerateContentRequest = z.infer<typeof GenerateContentRequestSchema>;

export const GenerateContentResponseSchema = z
  .object({ drafts: z.array(GeneratedItemSchema) })
  .strict();
export type GenerateContentResponse = z.infer<typeof GenerateContentResponseSchema>;

export const generateContentDef = defineCallable<GenerateContentRequest, GenerateContentResponse>({
  name: "v1.levelup.generateContent",
  module: "levelup",
  requestSchema: GenerateContentRequestSchema,
  responseSchema: GenerateContentResponseSchema,
  authMode: "authed",
  rateTier: "ai",
  authoritySensitive: true,
});
