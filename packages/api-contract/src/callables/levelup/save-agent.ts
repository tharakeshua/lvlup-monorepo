/**
 * v1.levelup.saveAgent — upsert a tutor/evaluator Agent. `systemPrompt`/`rules`
 * are ⚷ authoring-only; authoritySensitive (they leak how to score).
 */
import { z } from "zod";
import { zAgentType } from "@levelup/domain";
import { defineCallable } from "./_shared.js";
import { SaveOrDeleteResponseSchema } from "./_shared.js";

export const SaveAgentDataSchema = z
  .object({
    type: zAgentType,
    name: z.string().min(1),
    identity: z.string().optional(),
    isActive: z.boolean().optional(),
    systemPrompt: z.string().optional(),
    supportedLanguages: z.array(z.string()).optional(),
    defaultLanguage: z.string().optional(),
    maxConversationTurns: z.number().int().optional(),
    rules: z.array(z.string()).optional(),
    evaluationObjectives: z.array(z.string()).optional(),
    strictness: z.number().optional(),
    feedbackStyle: z.string().optional(),
    modelOverride: z.string().optional(),
    temperatureOverride: z.number().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const SaveAgentRequestSchema = z
  .object({
    id: z.string().optional(),
    spaceId: z.string(),
    data: SaveAgentDataSchema,
  })
  .strict();
export type SaveAgentRequest = z.infer<typeof SaveAgentRequestSchema>;

export const SaveAgentResponseSchema = SaveOrDeleteResponseSchema;
export type SaveAgentResponse = z.infer<typeof SaveAgentResponseSchema>;

export const saveAgentDef = defineCallable<SaveAgentRequest, SaveAgentResponse>({
  name: "v1.levelup.saveAgent",
  module: "levelup",
  requestSchema: SaveAgentRequestSchema,
  responseSchema: SaveAgentResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["agents"],
  authoritySensitive: true,
});
