/**
 * Typed accessor for the gamification repos off the shared `Repositories` bag
 * (domain plan gamification.md §Repositories, SDK-LAYERS-PLAN §4.1).
 *
 * The root `createRepositories(api)` bag folds every domain factory into one flat
 * record; this domain's repos (`achievementRepo`/`studentLevelRepo`/
 * `studyGoalRepo`/`studySessionRepo` + the two VIEW repos `leaderboardRepo`/
 * `gamificationViewRepo`) are reached through the bag's open `Record<string,Repo>`
 * tail. This module re-states the repo seams (structurally compatible with
 * `@levelup/repositories`' gamification exports) so the hooks call them with full
 * typing — NO `firebase`/transport import; repos are injected by `<ApiProvider>`
 * (query-infra.md §2/§3).
 *
 * Gamification is a derived / server-authoritative domain (no
 * `ALLOWED_TRANSITIONS`). The ONLY ✅ optimistic surface is `markSeen`
 * (mark-read class — flip `seen` + decrement the `unseenCount` badge); every
 * other write (`saveStudyGoal`, `saveAchievementDefinition`) round-trips because
 * `currentCount/completed` (goals) and unlock/lifecycle authority (definitions)
 * are server-owned (gamification.md §Authority boundary).
 */
import type {
  Achievement,
  AchievementCategory,
  GamificationSummary,
  IsoDate,
  LeaderboardEntry,
  LeaderboardScope,
  SpaceId,
  StoryPointId,
  StudentAchievement,
  StudentAchievementId,
  StudentLevel,
  StudyGoal,
  StudyGoalId,
  StudyGoalTargetType,
  StudySession,
  Timestamp,
  UserId,
} from "@levelup/domain";

// ── pagination + save envelopes ── DP-1: canonical types from api-contract.
// `SaveResponse` is the single `{ id: string; created?; deleted? }` shape (the
// prior `SaveResponse<Id>` — generic id, required `created`, no `deleted` — was drift).
import type {
  PageRequestInput as PageRequest,
  PageResponse,
  SaveResponse,
} from "@levelup/api-contract";

export type { PageRequest, PageResponse, SaveResponse };

// ── request/response shapes the hooks pass through ───────────────────────────

/** `listAchievements` row — definition joined with caller earned-state. */
export type AchievementWithEarnedState = Achievement & {
  earned: boolean;
  earnedAt: Timestamp | null;
};

export interface ListAchievementsRequest extends PageRequest {
  category?: AchievementCategory;
  onlyActive?: boolean;
}
export interface ListStudentAchievementsRequest extends PageRequest {
  userId?: UserId;
  unseenOnly?: boolean;
}
export interface GetLeaderboardRequest extends PageRequest {
  scope: LeaderboardScope;
  spaceId?: SpaceId;
  storyPointId?: StoryPointId;
}
export interface GetLeaderboardResponse extends PageResponse<LeaderboardEntry> {
  callerEntry: LeaderboardEntry | null;
}
export interface ListStudySessionsRequest {
  userId?: UserId;
  fromDate?: IsoDate;
  toDate?: IsoDate;
}
export interface ListStudySessionsResponse {
  sessions: StudySession[];
  streakDays: number;
  longestStreak: number;
}
export interface ListStudyGoalsRequest extends PageRequest {
  userId?: UserId;
  includeCompleted?: boolean;
  includeArchived?: boolean;
}
export interface SaveStudyGoalData {
  title: string;
  description?: string;
  targetType: StudyGoalTargetType;
  targetCount: number;
  startDate: IsoDate;
  endDate: IsoDate;
  deleted?: boolean;
}
export interface SaveStudyGoalRequest {
  id?: StudyGoalId;
  data: SaveStudyGoalData;
}
export type MarkAchievementsSeenRequest =
  | { achievementIds: StudentAchievementId[] }
  | { all: true };
export interface MarkAchievementsSeenResponse {
  updated: number;
}
export interface SaveAchievementDefinitionData {
  title: string;
  description: string;
  icon: string;
  category: Achievement["category"];
  rarity: Achievement["rarity"];
  tier: Achievement["tier"];
  criteria: Achievement["criteria"];
  pointsReward: number;
  isActive: boolean;
  deleted?: boolean;
}
export interface SaveAchievementDefinitionRequest {
  id?: Achievement["id"];
  data: SaveAchievementDefinitionData;
}

// ── repo seams (structural mirror of @levelup/repositories' gamification) ─────

export interface AchievementRepoSeam {
  listCatalog(filter?: ListAchievementsRequest): Promise<PageResponse<AchievementWithEarnedState>>;
  listEarned(opts?: ListStudentAchievementsRequest): Promise<PageResponse<StudentAchievement>>;
  markSeen(input: MarkAchievementsSeenRequest): Promise<MarkAchievementsSeenResponse>;
  saveDefinition(input: SaveAchievementDefinitionRequest): Promise<SaveResponse>;
  unseenCount(earned: readonly StudentAchievement[]): number;
}

export interface StudentLevelRepoSeam {
  get(userId?: UserId): Promise<StudentLevel>;
  progressToNext(level: Pick<StudentLevel, "currentXP" | "xpToNextLevel">): number;
}

export interface StudyGoalRepoSeam {
  list(opts?: ListStudyGoalsRequest): Promise<PageResponse<StudyGoal>>;
  save(input: SaveStudyGoalRequest): Promise<SaveResponse>;
  archive(goal: StudyGoal): Promise<SaveResponse>;
}

export interface StudySessionRepoSeam {
  list(range?: ListStudySessionsRequest): Promise<ListStudySessionsResponse>;
}

export interface LeaderboardRepoSeam {
  getPage(req: GetLeaderboardRequest): Promise<GetLeaderboardResponse>;
}

export interface GamificationViewRepoSeam {
  getSummary(userId?: UserId): Promise<GamificationSummary>;
}

/** The gamification slice of the injected `Repositories` bag. */
export interface GamificationDomainRepos {
  achievementRepo: AchievementRepoSeam;
  studentLevelRepo: StudentLevelRepoSeam;
  studyGoalRepo: StudyGoalRepoSeam;
  studySessionRepo: StudySessionRepoSeam;
  leaderboardRepo: LeaderboardRepoSeam;
  gamificationViewRepo: GamificationViewRepoSeam;
}

/**
 * Narrow the open `Repositories` bag to the gamification repo seam. The real bag
 * (a superset) is assignable; the cast is the sanctioned access path for the
 * `Record<string, Repo>` tail (mirrors `analyticsRepos`).
 */
export function gamificationRepos(repos: unknown): GamificationDomainRepos {
  return repos as GamificationDomainRepos;
}
