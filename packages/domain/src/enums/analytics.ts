import { zEnum } from "./enum.js";

/**
 * Analytics enums. `AT_RISK_REASONS` drops `no_recent_activity` (never emitted)
 * and keeps `zero_streak` (the enum-drift D-note reconciliation).
 */
export const AT_RISK_REASONS = [
  "low_exam_score",
  "no_recent_activity",
  "low_space_completion",
  "declining_performance",
  "zero_streak",
] as const;
export type AtRiskReason = (typeof AT_RISK_REASONS)[number];
export const zAtRiskReason = zEnum(AT_RISK_REASONS);

export const INSIGHT_TYPES = [
  "weak_topic_recommendation",
  "exam_preparation",
  "streak_encouragement",
  "improvement_celebration",
  "at_risk_intervention",
  "cross_system_correlation",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];
export const zInsightType = zEnum(INSIGHT_TYPES);

export const INSIGHT_PRIORITIES = ["high", "medium", "low"] as const;
export type InsightPriority = (typeof INSIGHT_PRIORITIES)[number];
export const zInsightPriority = zEnum(INSIGHT_PRIORITIES);

export const INSIGHT_ACTION_TYPES = [
  "practice_space",
  "review_exam",
  "seek_help",
  "celebrate",
] as const;
export type InsightActionType = (typeof INSIGHT_ACTION_TYPES)[number];
export const zInsightActionType = zEnum(INSIGHT_ACTION_TYPES);

export const LLM_CALL_STATUSES = ["success", "error"] as const;
export type LlmCallStatus = (typeof LLM_CALL_STATUSES)[number];
export const zLlmCallStatus = zEnum(LLM_CALL_STATUSES);

export const DAY_HEALTH_STATUSES = ["healthy", "degraded", "down"] as const;
export type DayHealthStatus = (typeof DAY_HEALTH_STATUSES)[number];
export const zDayHealthStatus = zEnum(DAY_HEALTH_STATUSES);

export const PLATFORM_ACTIVITY_ACTIONS = [
  "tenant_created",
  "tenant_updated",
  "tenant_deactivated",
  "tenant_reactivated",
  "user_created",
  "users_bulk_imported",
] as const;
export type PlatformActivityAction = (typeof PLATFORM_ACTIVITY_ACTIONS)[number];
export const zPlatformActivityAction = zEnum(PLATFORM_ACTIVITY_ACTIONS);

export const COST_SUMMARY_GRANULARITIES = ["daily", "monthly"] as const;
export type CostSummaryGranularity = (typeof COST_SUMMARY_GRANULARITIES)[number];
export const zCostSummaryGranularity = zEnum(COST_SUMMARY_GRANULARITIES);
