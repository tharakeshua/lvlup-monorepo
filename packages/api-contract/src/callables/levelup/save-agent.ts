/**
 * v1.levelup.saveAgent — upsert a tutor/interviewer/evaluator Agent.
 * `systemPrompt`/`rules` are ⚷ authoring-only; provider model names are not a
 * write surface (the server owns version increments and policy validation).
 */
import { z } from "zod";
import { zAgentId, zAgentType, zModelPolicyId, zSpaceId } from "@levelup/domain";
import { defineCallable } from "./_shared.js";

export const SaveAgentDataSchema = z
  .object({
    type: zAgentType,
    name: z.string().min(1),
    publicDescription: z.string().optional(),
    identity: z.string().optional(),
    isActive: z.boolean(),
    systemPrompt: z.string().optional(),
    supportedLanguages: z.array(z.string()).optional(),
    defaultLanguage: z.string().optional(),
    maxConversationTurns: z.number().int().optional(),
    rules: z.array(z.string()).optional(),
    openingMessage: z.string().optional(),
    evaluationObjectives: z.array(z.string()).optional(),
    strictness: z.number().optional(),
    feedbackStyle: z.string().optional(),
    modelPolicyId: zModelPolicyId,
    temperatureOverride: z.number().optional(),
    /** Legacy wording only: this is a CAS deactivation, never a hard delete. */
    deleted: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.deleted === true && data.isActive !== false) {
      ctx.addIssue({
        code: "custom",
        message: "deleted:true requires isActive:false; agents are deactivated, never hard-deleted",
        path: ["isActive"],
      });
    }
  });

const SaveAgentCreateRequestSchema = z
  .object({
    id: z.undefined().optional(),
    expectedVersion: z.literal(0).optional(),
    spaceId: zSpaceId,
    data: SaveAgentDataSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    // The retained deleted flag is a CAS deactivation compatibility path, not
    // a create-time state. It therefore always requires id + expectedVersion.
    if (request.data.deleted === true) {
      ctx.addIssue({
        code: "custom",
        message: "deleted:true requires an existing id and expectedVersion for CAS deactivation",
        path: ["data", "deleted"],
      });
    }
  });

const SaveAgentUpdateRequestSchema = z
  .object({
    id: zAgentId,
    expectedVersion: z.number().int().min(1),
    spaceId: zSpaceId,
    data: SaveAgentDataSchema,
  })
  .strict();

/**
 * CAS discriminator: creates omit `id` and accept only expectedVersion 0;
 * every update carries the current positive version. `spaceId` remains an
 * immutable server-checked parent reference after creation.
 */
export const SaveAgentRequestSchema = z.union([
  SaveAgentCreateRequestSchema,
  SaveAgentUpdateRequestSchema,
]);
export type SaveAgentRequest = z.infer<typeof SaveAgentRequestSchema>;

export const SaveAgentResponseSchema = z
  .object({
    id: zAgentId,
    created: z.boolean(),
    semanticChanged: z.boolean(),
    version: z.number().int().positive(),
    /** Present only for the retained deleted:true compatibility action. */
    deleted: z.literal(true).optional(),
  })
  .strict();
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
