/**
 * EvaluationSettings (EvaluationFeedbackRubric) — configurable feedback dimensions.
 * Collection: /tenants/{tenantId}/evaluationSettings/{settingsId}
 * @module autograde/evaluation-settings
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { EvaluationDimension } from "../content/rubric";

export interface EvaluationDisplaySettings {
  showStrengths: boolean;
  showKeyTakeaway: boolean;
  prioritizeByImportance: boolean;
}

export interface EvaluationConfidenceConfig {
  /** Below this threshold, grades are flagged as needs_review. Default: 0.7. */
  confidenceThreshold: number;
  /** Above this threshold, grades are auto-approved. Default: 0.9. */
  autoApproveThreshold: number;
  /** Whether to require human review for partial credit scores. */
  requireReviewForPartialCredit: boolean;
}

export interface UsageQuotaConfig {
  /** Monthly budget in USD. 0 = unlimited. */
  monthlyBudgetUsd: number;
  /** Daily call limit. 0 = unlimited. */
  dailyCallLimit: number;
  /** Percentage at which to show warning (0-100). Default: 80. */
  warningThresholdPercent: number;
}

export interface EvaluationSettings {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic?: boolean;

  // Enabled feedback dimensions
  enabledDimensions: EvaluationDimension[];

  // Display settings
  displaySettings: EvaluationDisplaySettings;

  // Confidence-based review settings
  confidenceConfig?: EvaluationConfidenceConfig;

  // AI usage quota settings
  usageQuota?: UsageQuotaConfig;

  createdBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
