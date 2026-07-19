/**
 * Analytics module callable defs — barrel.
 *
 * The 'core' agent owns `src/index.ts` and the global CALLABLES assembly; this
 * module exports a named record `ANALYTICS_CALLABLES` (keyed by callable name) for
 * core to spread into CALLABLES, plus all per-callable schemas/types and the shared
 * response shapes (PlatformSummary, ParentAlert, masteryDistribution, etc.).
 *
 * Plan: SDK-LAYERS-PLAN.md §2.6, §3.2 (analytics block), §9 (C6/C12/C18/C25/C29).
 */
export * from "./_schemas.js";

export * from "./get-summary.js";
export * from "./generate-report.js";
export * from "./get-exam-analytics.js";
export * from "./list-insights.js";
export * from "./dismiss-insight.js";
export * from "./get-performance-trends.js";
export * from "./get-child-summary.js";
export * from "./list-linked-children.js";
export * from "./get-cost-summary.js";
export * from "./get-leaderboard.js";
export * from "./list-parent-alerts.js";
export * from "./list-platform-activity.js";
export * from "./get-assignment-matrix.js";
export * from "./get-space-analytics.js";

import { getSummary } from "./get-summary.js";
import { generateReport } from "./generate-report.js";
import { getExamAnalytics } from "./get-exam-analytics.js";
import { listInsights } from "./list-insights.js";
import { dismissInsight } from "./dismiss-insight.js";
import { getPerformanceTrends } from "./get-performance-trends.js";
import { getChildSummary } from "./get-child-summary.js";
import { listLinkedChildren } from "./list-linked-children.js";
import { getCostSummary } from "./get-cost-summary.js";
import { getLeaderboard } from "./get-leaderboard.js";
import { listParentAlerts } from "./list-parent-alerts.js";
import { listPlatformActivity } from "./list-platform-activity.js";
import { getAssignmentMatrix } from "./get-assignment-matrix.js";
import { getSpaceAnalytics } from "./get-space-analytics.js";

/**
 * Named record of every analytics CallableDef, keyed by its `name`. Spread into the
 * global `CALLABLES as const` map by the core registry assembly.
 */
export const ANALYTICS_CALLABLES = {
  "v1.analytics.getSummary": getSummary,
  "v1.analytics.generateReport": generateReport,
  "v1.analytics.getExamAnalytics": getExamAnalytics,
  "v1.analytics.listInsights": listInsights,
  "v1.analytics.dismissInsight": dismissInsight,
  "v1.analytics.getPerformanceTrends": getPerformanceTrends,
  "v1.analytics.getChildSummary": getChildSummary,
  "v1.analytics.listLinkedChildren": listLinkedChildren,
  "v1.analytics.getCostSummary": getCostSummary,
  "v1.analytics.getLeaderboard": getLeaderboard,
  "v1.analytics.listParentAlerts": listParentAlerts,
  "v1.analytics.listPlatformActivity": listPlatformActivity,
  "v1.analytics.getAssignmentMatrix": getAssignmentMatrix,
  "v1.analytics.getSpaceAnalytics": getSpaceAnalytics,
} as const;
