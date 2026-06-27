/**
 * `gamification/` domain barrel (domain plan gamification.md §Query hooks).
 *
 * Read hooks (composed home / level / catalog / earned / leaderboard snapshot /
 * goals / sessions), the three realtime stream hooks (leaderboard-live /
 * achievement-unlock / level-live), and the mutation hooks — the ONLY ✅
 * optimistic surface is `useMarkAchievementsSeen` (mark-read class); every other
 * write round-trips because the underlying fields are server-derived/authority.
 * Plus the domain-shaped key helpers + the typed repo seam accessor.
 */
export {
  // reads
  useGamificationSummary,
  useStudentLevel,
  useAchievementCatalog,
  useStudentAchievements,
  useLeaderboardSnapshot,
  useStudyGoals,
  useStudySessions,
  // realtime
  useGamificationLeaderboardLive,
  useAchievementUnlockStream,
  useStudentLevelLive,
  // mutations
  useMarkAchievementsSeen,
  useSaveStudyGoal,
  useArchiveStudyGoal,
  useSaveAchievementDefinition,
} from "./hooks.js";

export { gamificationQueryKeys } from "./keys.js";
export { gamificationRepos } from "./repos.js";
export type {
  GamificationDomainRepos,
  AchievementRepoSeam,
  StudentLevelRepoSeam,
  StudyGoalRepoSeam,
  StudySessionRepoSeam,
  LeaderboardRepoSeam,
  GamificationViewRepoSeam,
  AchievementWithEarnedState,
  ListAchievementsRequest,
  ListStudentAchievementsRequest,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
  ListStudyGoalsRequest,
  ListStudySessionsRequest,
  ListStudySessionsResponse,
  SaveStudyGoalRequest,
  SaveStudyGoalData,
  MarkAchievementsSeenRequest,
  MarkAchievementsSeenResponse,
  SaveAchievementDefinitionRequest,
  SaveAchievementDefinitionData,
} from "./repos.js";
