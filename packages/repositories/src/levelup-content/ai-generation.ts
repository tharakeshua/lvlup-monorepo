/**
 * aiGenerationRepo (C13 — SDK-LAYERS-PLAN §3.2 folded list, §4.1, §4.3).
 *
 *   getGeneration(input)  — generateContent (ai): returns a DRAFT (no persist;
 *                           `generateContent→[]` invalidation, §4.3). Named with
 *                           the sanctioned `get*` IO prefix — it is a server
 *                           round-trip that returns generated draft content,
 *                           never an optimistic/local op.
 */
import { type ApiClientLike } from "./_kit";

export interface GenerateContentInput {
  topic?: string;
  spaceId?: string;
  storyPointId?: string;
  itemType?: string;
  count?: number;
  prompt?: string;
}

export interface AiGenerationRepo {
  getGeneration(input: GenerateContentInput): Promise<unknown>;
}

export function createAiGenerationRepo(api: ApiClientLike): AiGenerationRepo {
  const lv = api.levelup;
  return {
    getGeneration: (input) => lv["generateContent"]!(input),
  };
}
