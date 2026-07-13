/**
 * UsageQuota — Per-tenant AI usage quota enforcement.
 *
 * Checks current month's spending and call count against configured limits.
 * Provides soft warnings and hard limits.
 */

import * as admin from "firebase-admin";

export interface QuotaCheckResult {
  allowed: boolean;
  currentSpendUsd: number;
  currentCalls: number;
  monthlyBudgetUsd: number;
  dailyCallLimit: number;
  warningMessage?: string;
}

interface QuotaConfig {
  monthlyBudgetUsd: number;
  dailyCallLimit: number;
  warningThresholdPercent: number;
}

const DEFAULT_QUOTA: QuotaConfig = {
  monthlyBudgetUsd: 0, // 0 = unlimited
  dailyCallLimit: 0, // 0 = unlimited
  warningThresholdPercent: 80,
};

/**
 * Check whether a tenant can make another LLM call based on their quota.
 */
export async function checkUsageQuota(tenantId: string): Promise<QuotaCheckResult> {
  const db = admin.firestore();

  // Load tenant settings to get quota config
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  const tenantData = tenantDoc.data();
  const quota: QuotaConfig = {
    ...DEFAULT_QUOTA,
    ...((tenantData?.["settings"] as Record<string, unknown> | undefined)?.[
      "usageQuota"
    ] as Partial<QuotaConfig>),
  };

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = `${yearMonth}-${String(now.getDate()).padStart(2, "0")}`;

  // Get current month's cost summaries
  const summariesSnap = await db
    .collection(`tenants/${tenantId}/costSummaries`)
    .where("__name__", ">=", `${yearMonth}-01`)
    .where("__name__", "<=", `${yearMonth}-31`)
    .get();

  let currentSpendUsd = 0;
  let todayCalls = 0;
  let totalCalls = 0;

  for (const summaryDoc of summariesSnap.docs) {
    const data = summaryDoc.data();
    currentSpendUsd += (data["totalCostUsd"] as number) ?? 0;
    totalCalls += (data["totalCalls"] as number) ?? 0;
    if (summaryDoc.id === today) {
      todayCalls = (data["totalCalls"] as number) ?? 0;
    }
  }

  const result: QuotaCheckResult = {
    allowed: true,
    currentSpendUsd,
    currentCalls: totalCalls,
    monthlyBudgetUsd: quota.monthlyBudgetUsd,
    dailyCallLimit: quota.dailyCallLimit,
  };

  // Check monthly budget
  if (quota.monthlyBudgetUsd > 0) {
    const usagePercent = (currentSpendUsd / quota.monthlyBudgetUsd) * 100;

    if (usagePercent >= 100) {
      result.allowed = false;
      result.warningMessage =
        "AI grading quota reached for this month. Contact your administrator to increase the limit.";
      return result;
    }

    if (usagePercent >= quota.warningThresholdPercent) {
      result.warningMessage = `AI usage is at ${Math.round(usagePercent)}% of monthly budget ($${currentSpendUsd.toFixed(2)} / $${quota.monthlyBudgetUsd.toFixed(2)}).`;
    }
  }

  // Check daily call limit
  if (quota.dailyCallLimit > 0 && todayCalls >= quota.dailyCallLimit) {
    result.allowed = false;
    result.warningMessage = `Daily AI call limit reached (${todayCalls}/${quota.dailyCallLimit}). Try again tomorrow.`;
    return result;
  }

  return result;
}

/**
 * Increment the daily cost summary for a tenant.
 * Called after each successful LLM call.
 */
export async function incrementDailyCostSummary(
  tenantId: string,
  costUsd: number,
  inputTokens: number,
  outputTokens: number,
  purpose: string,
  model?: string
): Promise<void> {
  const db = admin.firestore();
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const summaryRef = db.doc(`tenants/${tenantId}/costSummaries/${dateKey}`);

  // Sanitize model name for Firestore field path (replace dots/slashes)
  const safeModelKey = (model ?? "unknown").replace(/[./]/g, "_");

  // Use FieldValue.increment for atomic updates
  await summaryRef.set(
    {
      date: dateKey,
      totalCalls: admin.firestore.FieldValue.increment(1),
      totalCostUsd: admin.firestore.FieldValue.increment(costUsd),
      totalInputTokens: admin.firestore.FieldValue.increment(inputTokens),
      totalOutputTokens: admin.firestore.FieldValue.increment(outputTokens),
      [`byPurpose.${purpose}.calls`]: admin.firestore.FieldValue.increment(1),
      [`byPurpose.${purpose}.costUsd`]: admin.firestore.FieldValue.increment(costUsd),
      [`byModel.${safeModelKey}.calls`]: admin.firestore.FieldValue.increment(1),
      [`byModel.${safeModelKey}.costUsd`]: admin.firestore.FieldValue.increment(costUsd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
