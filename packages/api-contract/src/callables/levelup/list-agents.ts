/**
 * v1.levelup.listAgents — agents for a space. `systemPrompt`/`rules` are ⚷ stripped
 * for non-authoring roles server-side.
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { AgentViewSchema } from "./_shared.js";

export const ListAgentsRequestSchema = z.object({ spaceId: z.string() }).strict();
export type ListAgentsRequest = z.infer<typeof ListAgentsRequestSchema>;

export const ListAgentsResponseSchema = z.object({ items: z.array(AgentViewSchema) }).strict();
export type ListAgentsResponse = z.infer<typeof ListAgentsResponseSchema>;

export const listAgentsDef = defineCallable<ListAgentsRequest, ListAgentsResponse>({
  name: "v1.levelup.listAgents",
  module: "levelup",
  requestSchema: ListAgentsRequestSchema,
  responseSchema: ListAgentsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
