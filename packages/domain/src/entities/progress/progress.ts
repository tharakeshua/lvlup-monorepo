/**
 * SpaceProgress + StoryPointProgress (embedded summary) + StoryPointProgressDoc
 * (subcollection) + ItemProgressEntry + QuestionProgressData + AttemptRecord.
 * All progress writes are ⚷ server-authoritative. Subcollections, not record-maps,
 * for heavy item detail (REVIEW D6) — but the bounded `items` map is kept per
 * storyPoint with the summary in the parent doc.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zSpaceProgressId,
  zUserId,
  zTenantId,
  zSpaceId,
  zStoryPointId,
  zItemId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zProgressStatus, zQuestionProgressStatus } from "../../enums/test-session.js";
import { zItemType } from "../../enums/content.js";
import { StoredEvaluationSchema } from "../content/stored-evaluation.js";

export const QuestionProgressDataSchema = zObject({
  status: zQuestionProgressStatus,
  attemptsCount: z.number().int().default(0),
  bestScore: z.number().optional(),
  pointsEarned: z.number().optional(),
  totalPoints: z.number().optional(),
  percentage: z.number().optional(),
  solved: z.boolean().default(false),
  latestScore: z.number().optional(),
  latestStatus: zQuestionProgressStatus.optional(),
});
export type QuestionProgressData = z.infer<typeof QuestionProgressDataSchema>;

export const AttemptRecordSchema = zObject({
  attemptNumber: z.number().int(),
  answer: z.unknown(),
  evaluation: StoredEvaluationSchema,
  score: z.number(),
  maxScore: z.number(),
  timestamp: zTimestamp,
});
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

export const ItemProgressEntrySchema = zObject({
  itemId: zItemId,
  itemType: zItemType,
  completed: z.boolean().default(false),
  completedAt: zTimestamp.nullable(),
  timeSpent: z.number().optional(),
  interactions: z.number().int().optional(),
  lastUpdatedAt: zTimestamp,
  // question-specific
  questionData: QuestionProgressDataSchema.optional(),
  // material-specific
  progress: z.number().optional(),
  score: z.number().optional(),
  feedback: z.string().optional(),
  // revisit display
  lastAnswer: z.unknown().optional(),
  lastEvaluation: StoredEvaluationSchema.optional(),
  attempts: z.array(AttemptRecordSchema).optional(),
});
export type ItemProgressEntry = z.infer<typeof ItemProgressEntrySchema>;

export const StoryPointProgressSchema = zObject({
  storyPointId: zStoryPointId,
  status: zProgressStatus,
  pointsEarned: z.number().default(0),
  totalPoints: z.number().default(0),
  percentage: z.number().default(0),
  completedItems: z.number().int().default(0),
  totalItems: z.number().int().default(0),
  completedAt: zTimestamp.nullable(),
});
export type StoryPointProgress = z.infer<typeof StoryPointProgressSchema>;

export const StoryPointProgressDocSchema = zObject({
  storyPointId: zStoryPointId,
  status: zProgressStatus,
  pointsEarned: z.number().default(0),
  totalPoints: z.number().default(0),
  percentage: z.number().default(0),
  completedItems: z.number().int().default(0),
  totalItems: z.number().int().default(0),
  completedAt: zTimestamp.nullable(),
  updatedAt: zTimestamp,
  items: z.record(z.string(), ItemProgressEntrySchema).default({}),
});
export type StoryPointProgressDoc = z.infer<typeof StoryPointProgressDocSchema>;

export const SpaceProgressSchema = zObject({
  id: zSpaceProgressId,
  userId: zUserId,
  tenantId: zTenantId,
  spaceId: zSpaceId,
  status: zProgressStatus,
  pointsEarned: z.number().default(0),
  totalPoints: z.number().default(0),
  marksEarned: z.number().optional(),
  totalMarks: z.number().optional(),
  percentage: z.number().default(0),
  storyPoints: z.record(z.string(), StoryPointProgressSchema).default({}),
  startedAt: zTimestamp.nullable(),
  completedAt: zTimestamp.nullable(),
  updatedAt: zTimestamp,
});
export type SpaceProgress = z.infer<typeof SpaceProgressSchema>;
