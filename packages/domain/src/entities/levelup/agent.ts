/**
 * Agent — tutor/evaluator. `rules` standardized to string[] (was single string —
 * REVIEW D12); `isActive` added. `systemPrompt`/`rules` are ⚷ authoring-only.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zAgentId, zSpaceId, zTenantId, zUserId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zAgentType } from "../../enums/content.js";

export const AgentSchema = zObject({
  id: zAgentId,
  spaceId: zSpaceId,
  tenantId: zTenantId,
  type: zAgentType,
  name: z.string(),
  identity: z.string().optional(),
  isActive: z.boolean(),
  // tutor fields
  systemPrompt: z.string().optional(),
  supportedLanguages: z.array(z.string()).optional(),
  defaultLanguage: z.string().optional(),
  maxConversationTurns: z.number().int().optional(),
  // evaluator fields (rules → string[] per D12)
  rules: z.array(z.string()).optional(),
  evaluationObjectives: z.array(z.string()).optional(),
  strictness: z.number().optional(),
  feedbackStyle: z.string().optional(),
  modelOverride: z.string().optional(),
  temperatureOverride: z.number().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Agent = z.infer<typeof AgentSchema>;
