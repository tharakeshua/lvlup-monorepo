/**
 * DigitalTestSession + TestSubmission (subcollection). `sessionType`/`serverDeadline`
 * canonical (REVIEW D12). The heavy `submissions` map is EXPLODED to a
 * `submissions/{itemId}` subcollection (REVIEW D6); the parent keeps lightweight
 * boolean maps. All authority fields (serverDeadline/isLatest/attemptNumber/scores)
 * are ⚷ server-written.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zTestSessionId,
  zTenantId,
  zUserId,
  zSpaceId,
  zStoryPointId,
  zItemId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zTestSessionStatus, zTestSessionType } from "../../enums/test-session.js";
import { zQuestionType } from "../../enums/content.js";
import { zDifficulty } from "../../enums/grading.js";
import { UnifiedEvaluationResultSchema } from "../content/evaluation-result.js";

export const AdaptiveStateSchema = zObject({
  currentDifficulty: zDifficulty,
  consecutiveCorrect: z.number().int().default(0),
  consecutiveIncorrect: z.number().int().default(0),
  answeredByDifficulty: z.record(z.string(), z.number().int()).optional(),
});
export type AdaptiveState = z.infer<typeof AdaptiveStateSchema>;

export const AnalyticsBreakdownEntrySchema = zObject({
  correct: z.number().int(),
  total: z.number().int(),
  points: z.number().optional(),
  maxPoints: z.number().optional(),
});
export type AnalyticsBreakdownEntry = z.infer<typeof AnalyticsBreakdownEntrySchema>;

export const TestAnalyticsSchema = zObject({
  topicBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  bloomsBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  difficultyBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  sectionBreakdown: z.record(z.string(), AnalyticsBreakdownEntrySchema).optional(),
  timePerQuestion: z.record(z.string(), z.number()).optional(),
  averageTimePerQuestion: z.number().optional(),
});
export type TestAnalytics = z.infer<typeof TestAnalyticsSchema>;

export const DifficultyProgressionEntrySchema = zObject({
  questionIndex: z.number().int(),
  difficulty: zDifficulty,
  correct: z.boolean(),
});
export type DifficultyProgressionEntry = z.infer<typeof DifficultyProgressionEntrySchema>;

export const DigitalTestSessionSchema = zObject({
  id: zTestSessionId,
  tenantId: zTenantId,
  userId: zUserId,
  spaceId: zSpaceId,
  storyPointId: zStoryPointId,
  sessionType: zTestSessionType,
  attemptNumber: z.number().int(),
  status: zTestSessionStatus,
  isLatest: z.boolean(),
  // timing (⚷ serverDeadline)
  startedAt: zTimestamp,
  endedAt: zTimestamp.nullable(),
  durationMinutes: z.number().int(),
  serverDeadline: zTimestamp.nullable(),
  // question tracking
  totalQuestions: z.number().int(),
  answeredQuestions: z.number().int().default(0),
  questionOrder: z.array(zItemId).default([]),
  // lightweight boolean maps kept inline (REVIEW D6)
  visitedQuestions: z.record(z.string(), z.boolean()).default({}),
  markedForReview: z.record(z.string(), z.boolean()).default({}),
  // scores (⚷ server-computed)
  pointsEarned: z.number().optional(),
  totalPoints: z.number().optional(),
  marksEarned: z.number().optional(),
  totalMarks: z.number().optional(),
  percentage: z.number().optional(),
  sectionMapping: z.record(z.string(), z.string()).optional(),
  lastVisitedIndex: z.number().int().optional(),
  // adaptive state
  adaptiveState: AdaptiveStateSchema.optional(),
  currentDifficultyLevel: zDifficulty.optional(),
  difficultyProgression: z.array(DifficultyProgressionEntrySchema).optional(),
  analytics: TestAnalyticsSchema.optional(),
  // audit
  submittedAt: zTimestamp.nullable(),
  autoSubmitted: z.boolean().optional(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type DigitalTestSession = z.infer<typeof DigitalTestSessionSchema>;

/** Subcollection `…/digitalTestSessions/{sessionId}/submissions/{itemId}`. */
export const TestSubmissionSchema = zObject({
  itemId: zItemId,
  questionType: zQuestionType,
  answer: z.unknown(),
  submittedAt: zTimestamp,
  timeSpentSeconds: z.number().int().optional(),
  // post-grade (⚷)
  evaluation: UnifiedEvaluationResultSchema.optional(),
  correct: z.boolean().optional(),
  pointsEarned: z.number().optional(),
  totalPoints: z.number().optional(),
});
export type TestSubmission = z.infer<typeof TestSubmissionSchema>;
