/**
 * Minimal structural view of the `@levelup/api-client` public surface the
 * gamification repos depend on (SDK-LAYERS-PLAN §1.2 — repos import
 * `@levelup/api-client` ONLY). `@levelup/api-client` is built concurrently in the
 * same wave; this file pins the plan-specified namespaced shape
 * (`api.<module>.<op>(req) → Promise<res>`) so this domain typechecks against the
 * declared public surface; the typecheck/fix wave reconciles any drift.
 *
 * The shape mirrors api-client-core.md §3.2 and the gamification domain plan
 * (gamification.md §API contract): every gamification student read/CRUD op lives
 * under `v1.levelup.*` (folded into the `levelup` module to avoid a 5th codebase).
 *
 * NO request carries `tenantId` (claim-derived server-side). Each callable is
 * `(req) => Promise<res>`; we type only the ops this domain invokes and keep a
 * permissive index tail so the real (superset) `ApiClient` is assignable here.
 */
import type {
  Achievement,
  AchievementCategory,
  IsoDate,
  GamificationSummary,
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

// DP-1: canonical wire envelopes from api-contract. `SaveResponse` is the single
// `{ id: string; created?: boolean; deleted?: boolean }` shape — the prior
// `SaveResponse<Id>` (generic id, required `created`, no `deleted`) was drift.
import type {
  PageRequestInput as PageRequest,
  PageResponse,
  SaveResponse,
  Callable,
} from "@levelup/api-contract";

export type { PageRequest, PageResponse, SaveResponse };

// ---------------------------------------------------------------------------
// READ shapes
// ---------------------------------------------------------------------------

/** `getGamificationSummary` — composed student home (collapses 5 reads → 1). */
export interface GetGamificationSummaryRequest {
  userId?: UserId;
}

/** `getStudentLevel`. */
export interface GetStudentLevelRequest {
  userId?: UserId;
}

/**
 * `listAchievements` — definitions catalog joined with caller earned-state.
 * `achievementWithEarnedStateSchema = achievementSchema.extend({ earned, earnedAt })`.
 */
export type AchievementWithEarnedState = Achievement & {
  earned: boolean;
  earnedAt: Timestamp | null;
};
export interface ListAchievementsRequest extends PageRequest {
  category?: AchievementCategory;
  onlyActive?: boolean;
}

/** `listStudentAchievements` — the caller's (or a child's) unlock records. */
export interface ListStudentAchievementsRequest extends PageRequest {
  userId?: UserId;
  unseenOnly?: boolean;
}

/** `getLeaderboard` — point-in-time projection (non-realtime first paint). */
export interface GetLeaderboardRequest extends PageRequest {
  scope: LeaderboardScope;
  spaceId?: SpaceId;
  storyPointId?: StoryPointId;
}
/** `pageResponse(leaderboardEntry).extend({ callerEntry })`. */
export interface GetLeaderboardResponse extends PageResponse<LeaderboardEntry> {
  callerEntry: LeaderboardEntry | null;
}

/** `listStudySessions` — heatmap/streak feed (server pre-computes streaks). */
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

/** `listStudyGoals`. */
export interface ListStudyGoalsRequest extends PageRequest {
  userId?: UserId;
  includeCompleted?: boolean;
  includeArchived?: boolean;
}

// ---------------------------------------------------------------------------
// WRITE shapes
// ---------------------------------------------------------------------------

/** `saveStudyGoal` — client-owned fields ONLY (`.strict()` rejects the rest). */
export interface SaveStudyGoalData {
  title: string;
  description?: string;
  targetType: StudyGoalTargetType;
  targetCount: number;
  startDate: IsoDate;
  endDate: IsoDate;
  /** soft-delete sugar (sets `archivedAt` server-side). */
  deleted?: boolean;
}
export interface SaveStudyGoalRequest {
  id?: StudyGoalId;
  data: SaveStudyGoalData;
}

/** `markAchievementsSeen` — flip `seen` on specific unlocks OR all. */
export type MarkAchievementsSeenRequest =
  | { achievementIds: StudentAchievementId[] }
  | { all: true };
export interface MarkAchievementsSeenResponse {
  updated: number;
}

/** `saveAchievementDefinition` (tenant-admin authoring — NOT student). */
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

/** A `levelup`-module callable surface (only the ops gamification calls). */
// `Callable<Req, Res>` imported from `@levelup/api-contract` (DP-1).

export interface LevelupNamespace {
  getGamificationSummary: Callable<GetGamificationSummaryRequest, GamificationSummary>;
  getStudentLevel: Callable<GetStudentLevelRequest, StudentLevel>;
  listAchievements: Callable<ListAchievementsRequest, PageResponse<AchievementWithEarnedState>>;
  listStudentAchievements: Callable<
    ListStudentAchievementsRequest,
    PageResponse<StudentAchievement>
  >;
  getLeaderboard: Callable<GetLeaderboardRequest, GetLeaderboardResponse>;
  listStudySessions: Callable<ListStudySessionsRequest, ListStudySessionsResponse>;
  listStudyGoals: Callable<ListStudyGoalsRequest, PageResponse<StudyGoal>>;
  saveStudyGoal: Callable<SaveStudyGoalRequest, SaveResponse>;
  markAchievementsSeen: Callable<MarkAchievementsSeenRequest, MarkAchievementsSeenResponse>;
  saveAchievementDefinition: Callable<SaveAchievementDefinitionRequest, SaveResponse>;
  // permissive tail — other levelup callables exist on the real client.
  [op: string]: (req: never) => Promise<unknown>;
}

/**
 * The structural slice of `ApiClient` this domain consumes. The real client (a
 * superset) is assignable to this. Repos accept this so they are testable
 * against a fake ApiClient seam.
 */
export interface ApiClient {
  levelup: LevelupNamespace;
  identity: Record<string, (req: never) => Promise<unknown>>;
  autograde: Record<string, (req: never) => Promise<unknown>>;
  analytics: Record<string, (req: never) => Promise<unknown>>;
}
