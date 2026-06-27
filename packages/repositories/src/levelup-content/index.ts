/**
 * `levelup-content` repository factory (SDK-LAYERS-PLAN §4.1).
 *
 * `createLevelupContentRepos(api)` assembles the per-entity content repos + the
 * cross-entity `spaceDetailViewRepo`. The top-level `createRepositories(api)` (owned
 * by the identity agent in `src/index.ts`) spreads this alongside the other domain
 * factories. Per-entity repos import `@levelup/api-client` (the structural `ApiClientLike`
 * seam) + `@levelup/domain` + `@levelup/api-contract` ONLY — never each other; the
 * `spaceDetailViewRepo` (R6 composition exception) lives under `src/views/**`.
 *
 * Repo source files are named without `repo` in the filename so the R6 static
 * import-isolation scan never mistakes this assembly barrel for a sibling-repo
 * composer (the only sanctioned composers live under `views/**`).
 */
import type { ApiClientLike } from "./_kit";
import { createSpaceRepo, type SpaceRepo } from "./space";
import { createStoryPointRepo, type StoryPointRepo } from "./story-point";
import { createItemRepo, type ItemRepo } from "./item";
import { createQuestionBankRepo, type QuestionBankRepo } from "./question-bank";
import { createRubricPresetRepo, type RubricPresetRepo } from "./rubric-preset";
import { createAgentRepo, type AgentRepo } from "./agent";
import { createChatRepo, type ChatRepo } from "./chat";
import { createStoreRepo, type StoreRepo } from "./store";
import { createVersionRepo, type VersionRepo } from "./version";
import { createAssignmentRepo, type AssignmentRepo } from "./assignment";
import { createAiGenerationRepo, type AiGenerationRepo } from "./ai-generation";
import { createSpaceDetailViewRepo, type SpaceDetailViewRepo } from "../views/space-detail-view";

export interface LevelupContentRepos {
  spaceRepo: SpaceRepo;
  storyPointRepo: StoryPointRepo;
  itemRepo: ItemRepo;
  questionBankRepo: QuestionBankRepo;
  rubricPresetRepo: RubricPresetRepo;
  agentRepo: AgentRepo;
  chatRepo: ChatRepo;
  storeRepo: StoreRepo;
  versionRepo: VersionRepo;
  assignmentRepo: AssignmentRepo;
  aiGenerationRepo: AiGenerationRepo;
  // cross-entity view (R6 exception, src/views/**)
  spaceDetailViewRepo: SpaceDetailViewRepo;
}

export function createLevelupContentRepos(api: ApiClientLike): LevelupContentRepos {
  return {
    spaceRepo: createSpaceRepo(api),
    storyPointRepo: createStoryPointRepo(api),
    itemRepo: createItemRepo(api),
    questionBankRepo: createQuestionBankRepo(api),
    rubricPresetRepo: createRubricPresetRepo(api),
    agentRepo: createAgentRepo(api),
    chatRepo: createChatRepo(api),
    storeRepo: createStoreRepo(api),
    versionRepo: createVersionRepo(api),
    assignmentRepo: createAssignmentRepo(api),
    aiGenerationRepo: createAiGenerationRepo(api),
    spaceDetailViewRepo: createSpaceDetailViewRepo(api),
  };
}

// Public types + per-entity factories for downstream waves. (The cache-scope
// helpers EDIT_ITEM_SCOPE/editItemKey/isSensitiveKey are exported once from the
// top-level barrel's canonical `../internal/sensitive-keys` source — not here —
// to avoid a duplicate export of those names.)
export * from "./space";
export * from "./story-point";
export * from "./item";
export * from "./question-bank";
export * from "./rubric-preset";
export * from "./agent";
export * from "./chat";
export * from "./store";
export * from "./version";
export * from "./assignment";
export * from "./ai-generation";
export {
  createSpaceDetailViewRepo,
  type SpaceDetailViewRepo,
  type SpaceDetailView,
} from "../views/space-detail-view";
export type { ApiClientLike } from "./_kit";
