/**
 * Rule-based Insight Engine — generates personalized LearningInsight objects
 * for students by analyzing their StudentProgressSummary, available exams, and spaces.
 *
 * No LLM involved — pure rule evaluation.
 */
import type { InsightType, InsightPriority, InsightActionType } from "@levelup/domain";
import type { StudentProgressSummary, LegacyTimestamp } from "../contracts/legacy-docs";
/** Minimal exam data needed for insight generation. */
export interface InsightExamData {
  id: string;
  title: string;
  linkedSpaceId?: string;
  linkedSpaceTitle?: string;
  classIds: string[];
  topics: string[];
  examDate?: LegacyTimestamp | null;
}
/** Minimal space data needed for insight generation. */
export interface InsightSpaceData {
  id: string;
  title: string;
  subject?: string;
  status: string;
}
/** Per-student space completion lookup. */
export type SpaceCompletionMap = Record<string, number>;
/** Aggregated exam-space correlation data: spaceId → { completedAvg, notCompletedAvg }. */
export type CorrelationData = Record<
  string,
  {
    completedAvg: number;
    notCompletedAvg: number;
    gap: number;
  }
>;
interface InsightSeed {
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  actionType: InsightActionType;
  actionEntityId?: string;
  actionEntityTitle?: string;
}
export interface InsightGenerationContext {
  summary: StudentProgressSummary;
  exams: InsightExamData[];
  spaces: InsightSpaceData[];
  spaceCompletion: SpaceCompletionMap;
  correlationData: CorrelationData;
}
/**
 * Generate all applicable insights for a student. Returns at most MAX_INSIGHTS_PER_STUDENT
 * seeds, prioritised high → medium → low.
 */
export declare function generateInsightsForStudent(ctx: InsightGenerationContext): InsightSeed[];
export {};
