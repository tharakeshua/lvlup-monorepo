/**
 * Conversation Agent — canonical tutor/interviewer/evaluator configuration.
 * `systemPrompt`/`rules` are ⚷ authoring-only. Provider model names never become
 * canonical data; a legacy read adapter below maps old docs to a safe policy ID.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zAgentId, zSpaceId, zTenantId, zUserId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zAgentType } from "../../enums/content.js";
import { zModelPolicyId } from "./conversation.js";

export const AgentSchema = zObject({
  id: zAgentId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  type: zAgentType,
  name: z.string(),
  publicDescription: z.string().optional(),
  identity: z.string().optional(),
  isActive: z.boolean(),
  // tutor fields
  systemPrompt: z.string().optional(),
  supportedLanguages: z.array(z.string()).optional(),
  defaultLanguage: z.string().optional(),
  maxConversationTurns: z.number().int().optional(),
  // evaluator fields (rules → string[] per D12)
  rules: z.array(z.string()).optional(),
  /** Static/config-derived first assistant message; never generated at start. */
  openingMessage: z.string().optional(),
  /** Evaluator persona guidance only; never substitutes item-private objectives. */
  evaluationObjectives: z.array(z.string()).optional(),
  strictness: z.number().optional(),
  feedbackStyle: z.string().optional(),
  modelPolicyId: zModelPolicyId,
  temperatureOverride: z.number().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
  // Incremented by the service for every semantic configuration update.
  version: z.number().int().positive(),
});
export type Agent = z.infer<typeof AgentSchema>;

/** Alias that makes the new conversational purpose explicit at call sites. */
export const ConversationAgentSchema = AgentSchema;
export type ConversationAgent = Agent;

/**
 * Read-only compatibility adapter for pre-policy agent documents. It accepts the
 * historical free-form `modelOverride` field, removes it from the normalized
 * value, and chooses a stable policy by agent role. New writes must use
 * `AgentSchema` / `modelPolicyId`; this adapter is never a write schema.
 */
export const LegacyAgentReadSchema = zObject({
  ...AgentSchema.shape,
  modelPolicyId: zModelPolicyId.optional(),
  version: z.number().int().positive().optional(),
  modelOverride: z.string().optional(),
}).transform((legacy) =>
  AgentSchema.parse({
    id: legacy.id,
    spaceId: legacy.spaceId,
    tenantId: legacy.tenantId,
    type: legacy.type,
    name: legacy.name,
    publicDescription: legacy.publicDescription,
    identity: legacy.identity,
    isActive: legacy.isActive,
    systemPrompt: legacy.systemPrompt,
    supportedLanguages: legacy.supportedLanguages,
    defaultLanguage: legacy.defaultLanguage,
    maxConversationTurns: legacy.maxConversationTurns,
    rules: legacy.rules,
    openingMessage: legacy.openingMessage,
    evaluationObjectives: legacy.evaluationObjectives,
    strictness: legacy.strictness,
    feedbackStyle: legacy.feedbackStyle,
    modelPolicyId:
      legacy.modelPolicyId ??
      (legacy.type === "evaluator" ? "evaluation.quality" : "conversation.quality"),
    temperatureOverride: legacy.temperatureOverride,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    createdBy: legacy.createdBy,
    updatedBy: legacy.updatedBy,
    version: legacy.version ?? 1,
  })
);
export type LegacyAgentRead = z.infer<typeof LegacyAgentReadSchema>;
