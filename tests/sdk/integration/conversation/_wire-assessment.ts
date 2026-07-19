/**
 * Assessment wire helpers. Re-exports the shared helpers and resolves the seeded
 * `chat_agent_question` assessment context (from `_wire.ts`'s deterministic seed).
 */
import { ASSESSMENT_CONTEXT, SEED_IDS } from "./_wire";

export {
  callAsStudent,
  conversationReady,
  seedConversationContent,
  uuid,
  ASSESSMENT_CONTEXT,
} from "./_wire";

export interface AssessmentReady {
  skip?: string;
  context?: typeof ASSESSMENT_CONTEXT;
}

/** The seeded assessment is always present once conversationReady() succeeded. */
export async function localSeedIdAssessment(): Promise<AssessmentReady> {
  if (!SEED_IDS.itemId) return { skip: "assessment seed ids unavailable" };
  return { context: ASSESSMENT_CONTEXT };
}
