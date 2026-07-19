/**
 * Cross-system analytics types.
 *
 * NOTE: The canonical ExamAnalytics type lives in autograde/exam-analytics.ts.
 * This module provides supplementary analytics types for the progress
 * aggregation layer (cost summaries, at-risk detection, etc.).
 *
 * @module progress/analytics
 */

import type { FirestoreTimestamp } from "../identity/user";

// ── Daily Cost Summary ──────────────────────────────────────────────────────

export interface DailyCostSummary {
  id: string; // {date} — YYYY-MM-DD
  tenantId: string;
  date: string; // YYYY-MM-DD

  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;

  byPurpose: Record<
    string,
    {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }
  >;

  byModel: Record<
    string,
    {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }
  >;

  budgetLimitUsd?: number;
  budgetUsedPercent?: number;
  budgetAlertSent?: boolean;

  computedAt: FirestoreTimestamp;
}

// ── At-Risk Detection ───────────────────────────────────────────────────────

export type AtRiskReason =
  | "low_exam_score"
  | "no_recent_activity"
  | "low_space_completion"
  | "declining_performance"
  | "zero_streak";

export interface AtRiskDetectionResult {
  studentId: string;
  tenantId: string;
  isAtRisk: boolean;
  reasons: AtRiskReason[];
  details: Record<string, string>;
  detectedAt: FirestoreTimestamp;
}

// NOTE: Notification types live in notification/notification.ts.
// The canonical Notification interface is exported from there.
