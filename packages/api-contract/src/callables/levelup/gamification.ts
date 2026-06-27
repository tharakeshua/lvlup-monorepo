/**
 * Folded gamification + insight + study callable defs for the `levelup` module
 * (SDK-LAYERS-PLAN §2.4 / §3.2 levelup block — gamification folds into `levelup`,
 * no 5th codebase). One named record (`GAMIFICATION_CALLABLES`) spread by the
 * levelup barrel into `LEVELUP_CALLABLES`.
 *
 * `module` stays `'levelup'` (these deploy in `functions/levelup`); the
 * leaderboard *live subscription* is the only `'analytics'`-module gamification
 * surface. No request schema carries `tenantId` (claim-derived) or a literal
 * `idempotencyKey` (rides the api-client envelope).
 */
import { z } from "zod";
import {
  GamificationSummarySchema,
  StudentLevelSchema,
  AchievementSchema,
  StudentAchievementSchema,
  LeaderboardEntrySchema,
  StudyGoalSchema,
  StudySessionSchema,
  LearningInsightSchema,
} from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { PageRequest, pageResponse } from "../../pagination.js";
import { SaveResponseSchema } from "./_shared.js";

// ---- gamification reads ----
export const GetGamificationSummaryRequestSchema = z
  .object({ userId: z.string().optional() })
  .strict();
export type GetGamificationSummaryRequest = z.infer<typeof GetGamificationSummaryRequestSchema>;
export type GetGamificationSummaryResponse = z.infer<typeof GamificationSummarySchema>;

export const getGamificationSummaryDef = defineCallable<
  GetGamificationSummaryRequest,
  GetGamificationSummaryResponse
>({
  name: "v1.levelup.getGamificationSummary",
  module: "levelup",
  requestSchema: GetGamificationSummaryRequestSchema,
  responseSchema: GamificationSummarySchema,
  authMode: "authed",
  rateTier: "read",
});

export const GetStudentLevelRequestSchema = z.object({ userId: z.string().optional() }).strict();
export type GetStudentLevelRequest = z.infer<typeof GetStudentLevelRequestSchema>;
export type GetStudentLevelResponse = z.infer<typeof StudentLevelSchema>;

export const getStudentLevelDef = defineCallable<GetStudentLevelRequest, GetStudentLevelResponse>({
  name: "v1.levelup.getStudentLevel",
  module: "levelup",
  requestSchema: GetStudentLevelRequestSchema,
  responseSchema: StudentLevelSchema,
  authMode: "authed",
  rateTier: "read",
});

export const ListAchievementsRequestSchema = z
  .object({ category: z.string().optional(), onlyActive: z.boolean().optional() })
  .extend(PageRequest.shape)
  .strict();
export type ListAchievementsRequest = z.infer<typeof ListAchievementsRequestSchema>;
export const AchievementWithEarnedStateSchema = AchievementSchema.extend({
  earned: z.boolean(),
}).strict();
export const ListAchievementsResponseSchema = pageResponse(AchievementWithEarnedStateSchema);
export type ListAchievementsResponse = z.infer<typeof ListAchievementsResponseSchema>;

export const listAchievementsDef = defineCallable<
  ListAchievementsRequest,
  ListAchievementsResponse
>({
  name: "v1.levelup.listAchievements",
  module: "levelup",
  requestSchema: ListAchievementsRequestSchema,
  responseSchema: ListAchievementsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

export const ListStudentAchievementsRequestSchema = z
  .object({ userId: z.string().optional(), unseenOnly: z.boolean().optional() })
  .extend(PageRequest.shape)
  .strict();
export type ListStudentAchievementsRequest = z.infer<typeof ListStudentAchievementsRequestSchema>;
export const ListStudentAchievementsResponseSchema = pageResponse(StudentAchievementSchema);
export type ListStudentAchievementsResponse = z.infer<typeof ListStudentAchievementsResponseSchema>;

export const listStudentAchievementsDef = defineCallable<
  ListStudentAchievementsRequest,
  ListStudentAchievementsResponse
>({
  name: "v1.levelup.listStudentAchievements",
  module: "levelup",
  requestSchema: ListStudentAchievementsRequestSchema,
  responseSchema: ListStudentAchievementsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

// ---- gamification writes ----
export const MarkAchievementsSeenRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("ids"), achievementIds: z.array(z.string()) }).strict(),
  z.object({ mode: z.literal("all") }).strict(),
]);
export type MarkAchievementsSeenRequest = z.infer<typeof MarkAchievementsSeenRequestSchema>;
export const MarkAchievementsSeenResponseSchema = z
  .object({ updated: z.number().int().nonnegative() })
  .strict();
export type MarkAchievementsSeenResponse = z.infer<typeof MarkAchievementsSeenResponseSchema>;

export const markAchievementsSeenDef = defineCallable<
  MarkAchievementsSeenRequest,
  MarkAchievementsSeenResponse
>({
  name: "v1.levelup.markAchievementsSeen",
  module: "levelup",
  requestSchema: MarkAchievementsSeenRequestSchema,
  responseSchema: MarkAchievementsSeenResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["achievements", "gamification"],
});

export const SaveAchievementDefinitionRequestSchema = z
  .object({
    id: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveAchievementDefinitionRequest = z.infer<
  typeof SaveAchievementDefinitionRequestSchema
>;
export type SaveAchievementDefinitionResponse = z.infer<typeof SaveResponseSchema>;

export const saveAchievementDefinitionDef = defineCallable<
  SaveAchievementDefinitionRequest,
  SaveAchievementDefinitionResponse
>({
  name: "v1.levelup.saveAchievementDefinition",
  module: "levelup",
  requestSchema: SaveAchievementDefinitionRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["achievements"],
  authoritySensitive: true,
});

// ---- leaderboard ----
export const GetLeaderboardRequestSchema = z
  .object({
    scope: z.string(),
    spaceId: z.string().optional(),
    storyPointId: z.string().optional(),
  })
  .extend(PageRequest.shape)
  .strict();
export type GetLeaderboardRequest = z.infer<typeof GetLeaderboardRequestSchema>;
export const GetLeaderboardResponseSchema = pageResponse(LeaderboardEntrySchema)
  .extend({ callerEntry: LeaderboardEntrySchema.nullable() })
  .strict();
export type GetLeaderboardResponse = z.infer<typeof GetLeaderboardResponseSchema>;

export const getLeaderboardDef = defineCallable<GetLeaderboardRequest, GetLeaderboardResponse>({
  name: "v1.levelup.getLeaderboard",
  module: "levelup",
  requestSchema: GetLeaderboardRequestSchema,
  responseSchema: GetLeaderboardResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

// ---- study goals + sessions ----
export const ListStudyGoalsRequestSchema = z
  .object({ userId: z.string().optional(), includeCompleted: z.boolean().optional() })
  .extend(PageRequest.shape)
  .strict();
export type ListStudyGoalsRequest = z.infer<typeof ListStudyGoalsRequestSchema>;
export const ListStudyGoalsResponseSchema = pageResponse(StudyGoalSchema);
export type ListStudyGoalsResponse = z.infer<typeof ListStudyGoalsResponseSchema>;

export const listStudyGoalsDef = defineCallable<ListStudyGoalsRequest, ListStudyGoalsResponse>({
  name: "v1.levelup.listStudyGoals",
  module: "levelup",
  requestSchema: ListStudyGoalsRequestSchema,
  responseSchema: ListStudyGoalsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

export const SaveStudyGoalRequestSchema = z
  .object({ id: z.string().optional(), data: z.record(z.string(), z.unknown()) })
  .strict();
export type SaveStudyGoalRequest = z.infer<typeof SaveStudyGoalRequestSchema>;
export type SaveStudyGoalResponse = z.infer<typeof SaveResponseSchema>;

export const saveStudyGoalDef = defineCallable<SaveStudyGoalRequest, SaveStudyGoalResponse>({
  name: "v1.levelup.saveStudyGoal",
  module: "levelup",
  requestSchema: SaveStudyGoalRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["studyGoals"],
});

export const ListStudySessionsRequestSchema = z
  .object({
    userId: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  })
  .strict();
export type ListStudySessionsRequest = z.infer<typeof ListStudySessionsRequestSchema>;
export const ListStudySessionsResponseSchema = z
  .object({
    sessions: z.array(StudySessionSchema),
    streakDays: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
  })
  .strict();
export type ListStudySessionsResponse = z.infer<typeof ListStudySessionsResponseSchema>;

export const listStudySessionsDef = defineCallable<
  ListStudySessionsRequest,
  ListStudySessionsResponse
>({
  name: "v1.levelup.listStudySessions",
  module: "levelup",
  requestSchema: ListStudySessionsRequestSchema,
  responseSchema: ListStudySessionsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

// ---- learning insights (testsession-owned, levelup-named) ----
export const ListLearningInsightsRequestSchema = z
  .object({ studentId: z.string().optional(), type: z.string().optional() })
  .extend(PageRequest.shape)
  .strict();
export type ListLearningInsightsRequest = z.infer<typeof ListLearningInsightsRequestSchema>;
export const ListLearningInsightsResponseSchema = pageResponse(LearningInsightSchema);
export type ListLearningInsightsResponse = z.infer<typeof ListLearningInsightsResponseSchema>;

export const listLearningInsightsDef = defineCallable<
  ListLearningInsightsRequest,
  ListLearningInsightsResponse
>({
  name: "v1.levelup.listLearningInsights",
  module: "levelup",
  requestSchema: ListLearningInsightsRequestSchema,
  responseSchema: ListLearningInsightsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

export const DismissInsightRequestSchema = z.object({ insightId: z.string() }).strict();
export type DismissInsightRequest = z.infer<typeof DismissInsightRequestSchema>;
export const DismissInsightResponseSchema = z
  .object({ id: z.string(), dismissed: z.literal(true) })
  .strict();
export type DismissInsightResponse = z.infer<typeof DismissInsightResponseSchema>;

export const dismissInsightDef = defineCallable<DismissInsightRequest, DismissInsightResponse>({
  name: "v1.levelup.dismissInsight",
  module: "levelup",
  requestSchema: DismissInsightRequestSchema,
  responseSchema: DismissInsightResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["insights"],
});

/** Named record of the folded gamification/insight/study defs (spread by the barrel). */
export const GAMIFICATION_CALLABLES = {
  "v1.levelup.getGamificationSummary": getGamificationSummaryDef,
  "v1.levelup.getStudentLevel": getStudentLevelDef,
  "v1.levelup.listAchievements": listAchievementsDef,
  "v1.levelup.listStudentAchievements": listStudentAchievementsDef,
  "v1.levelup.markAchievementsSeen": markAchievementsSeenDef,
  "v1.levelup.saveAchievementDefinition": saveAchievementDefinitionDef,
  "v1.levelup.getLeaderboard": getLeaderboardDef,
  "v1.levelup.listStudyGoals": listStudyGoalsDef,
  "v1.levelup.saveStudyGoal": saveStudyGoalDef,
  "v1.levelup.listStudySessions": listStudySessionsDef,
  "v1.levelup.listLearningInsights": listLearningInsightsDef,
  "v1.levelup.dismissInsight": dismissInsightDef,
} as const;
