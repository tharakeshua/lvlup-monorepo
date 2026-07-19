/**
 * Agent entity — AI tutor or evaluator agent.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}
 * @module levelup/agent
 */

import type { FirestoreTimestamp } from "../identity/user";

export type AgentType = "tutor" | "evaluator";

export interface EvaluationObjective {
  id: string;
  name: string;
  points: number;
  description?: string;
}

export interface Agent {
  id: string;
  spaceId: string;
  tenantId: string;

  type: AgentType;
  name: string;
  identity: string;

  // Tutor-specific
  systemPrompt?: string;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  maxConversationTurns?: number;

  // Evaluator-specific
  rules?: string;
  evaluationObjectives?: EvaluationObjective[];
  strictness?: "lenient" | "moderate" | "strict";
  feedbackStyle?: "brief" | "detailed" | "encouraging";

  // Shared
  modelOverride?: string;
  temperatureOverride?: number;

  // Audit
  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
