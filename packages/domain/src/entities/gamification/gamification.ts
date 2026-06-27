/**
 * Gamification entities — derived, server-authoritative state (only StudyGoal CRUD +
 * StudentAchievement.seen are client-mutable). Keys on student `userId: UserId`.
 * Calendar dates use branded `IsoDate` for timezone-stable streak math; instants use
 * ISO `Timestamp`.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zAchievementId,
  zStudentAchievementId,
  zStudyGoalId,
  zStudySessionId,
  zUserId,
  zTenantId,
  zSpaceId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zIsoDate } from "../../primitives/iso-date.zod.js";
import {
  zAchievementCategory,
  zAchievementRarity,
  zAchievementTier,
  zAchievementCriteriaType,
  zStudyGoalTargetType,
} from "../../enums/gamification.js";

export const AchievementCriteriaSchema = zObject({
  type: zAchievementCriteriaType,
  threshold: z.number().int().min(1),
  subject: z.string().optional(),
  spaceId: zSpaceId.optional(),
});
export type AchievementCriteria = z.infer<typeof AchievementCriteriaSchema>;

export const AchievementSchema = zObject({
  id: zAchievementId,
  tenantId: zTenantId,
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  category: zAchievementCategory,
  rarity: zAchievementRarity,
  tier: zAchievementTier,
  criteria: AchievementCriteriaSchema,
  pointsReward: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  archivedAt: zTimestamp.nullable(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const StudentAchievementSchema = zObject({
  id: zStudentAchievementId,
  tenantId: zTenantId,
  userId: zUserId,
  achievementId: zAchievementId,
  // denormalized snapshot for display (server writes at unlock).
  achievement: AchievementSchema,
  earnedAt: zTimestamp,
  // the ONLY client-mutable field (mark-read).
  seen: z.boolean(),
});
export type StudentAchievement = z.infer<typeof StudentAchievementSchema>;

export const StudentLevelSchema = zObject({
  id: zUserId,
  tenantId: zTenantId,
  userId: zUserId,
  level: z.number().int().min(1),
  currentXP: z.number().int().min(0),
  xpToNextLevel: z.number().int().min(0),
  totalXP: z.number().int().min(0),
  tier: zAchievementTier,
  achievementCount: z.number().int().min(0),
  updatedAt: zTimestamp,
});
export type StudentLevel = z.infer<typeof StudentLevelSchema>;

export const StudyGoalSchema = zObject({
  id: zStudyGoalId,
  tenantId: zTenantId,
  userId: zUserId,
  title: z.string(),
  description: z.string().optional(),
  targetType: zStudyGoalTargetType,
  targetCount: z.number().int().min(1),
  // server-derived
  currentCount: z.number().int().min(0),
  startDate: zIsoDate,
  endDate: zIsoDate,
  completed: z.boolean(),
  completedAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  archivedAt: zTimestamp.nullable(),
});
export type StudyGoal = z.infer<typeof StudyGoalSchema>;

export const StudySessionSchema = zObject({
  id: zStudySessionId,
  tenantId: zTenantId,
  userId: zUserId,
  date: zIsoDate,
  minutesStudied: z.number().int().min(0),
  spacesWorked: z.array(zSpaceId).default([]),
  itemsCompleted: z.number().int().min(0),
  pointsEarned: z.number().int().min(0),
});
export type StudySession = z.infer<typeof StudySessionSchema>;

/** Read-model only — mirror of the RTDB leaderboard node. Never client-writable. */
export const LeaderboardEntrySchema = zObject({
  userId: zUserId,
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  score: z.number(),
  overallScore: z.number().optional(),
  examAvg: z.number().optional(),
  spaceCompletion: z.number().optional(),
  totalPoints: z.number(),
  streakDays: z.number().int(),
  tier: zAchievementTier.optional(),
  countsByTier: z.record(z.string(), z.number().int()).optional(),
  rank: z.number().int(),
  isAtRisk: z.boolean().optional(),
  updatedAt: zTimestamp,
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/** Composed view-model assembled by the repo; used as a response schema. */
export const GamificationSummarySchema = zObject({
  level: StudentLevelSchema,
  recentAchievements: z.array(StudentAchievementSchema),
  unseenCount: z.number().int().min(0),
  currentStreakDays: z.number().int().min(0),
  tenantRank: z.number().int().nullable(),
  activeGoals: z.array(StudyGoalSchema),
});
export type GamificationSummary = z.infer<typeof GamificationSummarySchema>;
