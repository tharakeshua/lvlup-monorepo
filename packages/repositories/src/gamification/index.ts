/**
 * @levelup/repositories — `gamification` domain factory
 * (SDK-LAYERS-PLAN §4.1, §2, gamification.md §Repositories).
 *
 * The root `createRepositories(api)` assembly (src/index.ts) is owned by the
 * 'identity' agent; this domain exports `createGamificationRepos(api)` — the
 * plan-specified per-domain factory the root assembler folds into the flat bag.
 *
 * Per-entity repos: achievementRepo, studentLevelRepo, studyGoalRepo,
 * studySessionRepo. Cross-entity VIEW repos (under src/views/**, the only
 * sanctioned composition surface — R6 exception): leaderboardRepo,
 * gamificationViewRepo — returned alongside so the assembler places them in the
 * bag.
 *
 * Every repo imports `@levelup/api-client` (via the `ApiClient` view) +
 * `@levelup/domain` ONLY — never a sibling repo (R6). Gamification is
 * derived/server-authoritative: the only client writes are StudyGoal CRUD and the
 * markAchievementsSeen acknowledgement; there is no client lifecycle, hence NO
 * ALLOWED_TRANSITIONS entry for this domain (gamification.md §ALLOWED_TRANSITIONS).
 */
import type { ApiClient } from "./api-types.js";
import { createAchievementRepo, type AchievementRepo } from "./achievement.js";
import { createStudentLevelRepo, type StudentLevelRepo } from "./student-level.js";
import { createStudyGoalRepo, type StudyGoalRepo } from "./study-goal.js";
import { createStudySessionRepo, type StudySessionRepo } from "./study-session.js";
import { createLeaderboardRepo, type LeaderboardRepo } from "../views/leaderboard.js";
import {
  createGamificationViewRepo,
  type GamificationViewRepo,
} from "../views/gamification-view.js";

export interface GamificationRepos {
  achievementRepo: AchievementRepo;
  studentLevelRepo: StudentLevelRepo;
  studyGoalRepo: StudyGoalRepo;
  studySessionRepo: StudySessionRepo;
  /** Cross-entity VIEW repo (src/views/**) — the leaderboard board composer. */
  leaderboardRepo: LeaderboardRepo;
  /** Cross-entity VIEW repo (src/views/**) — the composed gamification home. */
  gamificationViewRepo: GamificationViewRepo;
}

export function createGamificationRepos(api: ApiClient): GamificationRepos {
  return {
    achievementRepo: createAchievementRepo(api),
    studentLevelRepo: createStudentLevelRepo(api),
    studyGoalRepo: createStudyGoalRepo(api),
    studySessionRepo: createStudySessionRepo(api),
    leaderboardRepo: createLeaderboardRepo(api),
    gamificationViewRepo: createGamificationViewRepo(api),
  };
}

// Public re-exports (types + sub-factories) for the root assembler + apps.
export type {
  ApiClient,
  PageRequest,
  PageResponse,
  SaveResponse,
  AchievementWithEarnedState,
  GetGamificationSummaryRequest,
  GetStudentLevelRequest,
  ListAchievementsRequest,
  ListStudentAchievementsRequest,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
  ListStudySessionsRequest,
  ListStudySessionsResponse,
  ListStudyGoalsRequest,
  SaveStudyGoalRequest,
  SaveStudyGoalData,
  MarkAchievementsSeenRequest,
  MarkAchievementsSeenResponse,
  SaveAchievementDefinitionRequest,
  SaveAchievementDefinitionData,
} from "./api-types.js";

export {
  createAchievementRepo,
  type AchievementRepo,
  type AchievementsByCategory,
} from "./achievement.js";
export { createStudentLevelRepo, type StudentLevelRepo } from "./student-level.js";
export { createStudyGoalRepo, type StudyGoalRepo } from "./study-goal.js";
export {
  createStudySessionRepo,
  type StudySessionRepo,
  type HeatmapCell,
} from "./study-session.js";
export {
  createLeaderboardRepo,
  type LeaderboardRepo,
  type LeaderboardPage,
  type LeaderboardPageOpts,
  type LeaderboardLivePayload,
} from "../views/leaderboard.js";
export {
  createGamificationViewRepo,
  type GamificationViewRepo,
} from "../views/gamification-view.js";

export { paginate, listOnce, type PageBag, type Paged } from "./paginate.js";
