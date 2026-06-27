/**
 * dailyCostAggregation — Cloud Scheduler function that runs at 1:00 AM daily.
 * Aggregates LLM call logs from the previous day into a DailyCostSummary
 * document and checks budget limits.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DailyCostSummary } from "@levelup/shared-types";

const BUDGET_WARNING_THRESHOLD = 0.8; // 80%
const BUDGET_EXCEEDED_THRESHOLD = 1.0; // 100%

export const dailyCostAggregation = onSchedule(
  {
    schedule: "5 0 * * *", // 00:05 AM daily (UTC)
    timeZone: "UTC",
    region: "asia-south1",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();

    // Calculate yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    // Get all tenants
    const tenantsSnap = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;

      // Query LLM call logs for yesterday
      const logsSnap = await db
        .collection(`tenants/${tenantId}/llmCallLogs`)
        .where("createdAt", ">=", startTimestamp)
        .where("createdAt", "<=", endTimestamp)
        .get();

      if (logsSnap.empty) continue;

      let totalCalls = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostUsd = 0;

      const byPurpose: Record<
        string,
        { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
      > = {};

      const byModel: Record<
        string,
        { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
      > = {};

      for (const doc of logsSnap.docs) {
        const log = doc.data();

        totalCalls++;
        const input = log.tokens?.input ?? 0;
        const output = log.tokens?.output ?? 0;
        const cost = log.cost?.total ?? log.cost?.totalUsd ?? 0;

        totalInputTokens += input;
        totalOutputTokens += output;
        totalCostUsd += cost;

        // By purpose
        const purpose = (log.purpose as string) ?? "unknown";
        if (!byPurpose[purpose]) {
          byPurpose[purpose] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
        }
        byPurpose[purpose].calls++;
        byPurpose[purpose].inputTokens += input;
        byPurpose[purpose].outputTokens += output;
        byPurpose[purpose].costUsd += cost;

        // By model
        const model = (log.model as string) ?? "unknown";
        if (!byModel[model]) {
          byModel[model] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
        }
        byModel[model].calls++;
        byModel[model].inputTokens += input;
        byModel[model].outputTokens += output;
        byModel[model].costUsd += cost;
      }

      // Check budget limits
      const tenantData = tenantDoc.data();
      const budgetLimitUsd = tenantData.subscription?.monthlyBudgetUsd as number | undefined;

      let budgetUsedPercent: number | undefined;
      let budgetAlertSent = false;

      if (budgetLimitUsd && budgetLimitUsd > 0) {
        // Get monthly total so far
        const monthStr = dateStr.substring(0, 7); // YYYY-MM
        const monthlySummarySnap = await db
          .collection(`tenants/${tenantId}/costSummaries/monthly`)
          .doc(monthStr)
          .get();

        const existingMonthCost = monthlySummarySnap.data()?.totalCostUsd ?? 0;
        const monthTotal = existingMonthCost + totalCostUsd;
        budgetUsedPercent = (monthTotal / budgetLimitUsd) * 100;

        if (budgetUsedPercent >= BUDGET_EXCEEDED_THRESHOLD * 100) {
          console.warn(
            `BUDGET EXCEEDED for tenant ${tenantId}: ${budgetUsedPercent.toFixed(1)}% used`
          );
          budgetAlertSent = true;
        } else if (budgetUsedPercent >= BUDGET_WARNING_THRESHOLD * 100) {
          console.warn(
            `BUDGET WARNING for tenant ${tenantId}: ${budgetUsedPercent.toFixed(1)}% used`
          );
          budgetAlertSent = true;
        }
      }

      const costSummary: Omit<DailyCostSummary, "computedAt"> & {
        computedAt: FieldValue;
      } = {
        id: dateStr,
        tenantId,
        date: dateStr,
        totalCalls,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        byPurpose,
        byModel,
        budgetLimitUsd,
        budgetUsedPercent,
        budgetAlertSent,
        computedAt: FieldValue.serverTimestamp(),
      };

      const dailyDocRef = db.doc(`tenants/${tenantId}/costSummaries/daily/${dateStr}`);
      const monthStr = dateStr.substring(0, 7);
      const monthlyDocRef = db.doc(`tenants/${tenantId}/costSummaries/monthly/${monthStr}`);

      // Check if daily doc already exists (idempotency guard for monthly increment)
      const existingDailySnap = await dailyDocRef.get();
      const previousDailyCost = existingDailySnap.exists
        ? (existingDailySnap.data()?.totalCostUsd ?? 0)
        : 0;
      const previousDailyCalls = existingDailySnap.exists
        ? (existingDailySnap.data()?.totalCalls ?? 0)
        : 0;
      const previousDailyInput = existingDailySnap.exists
        ? (existingDailySnap.data()?.totalInputTokens ?? 0)
        : 0;
      const previousDailyOutput = existingDailySnap.exists
        ? (existingDailySnap.data()?.totalOutputTokens ?? 0)
        : 0;

      await dailyDocRef.set(costSummary);

      // Update monthly running total using delta (new - old) to stay idempotent on re-runs
      const deltaCost = totalCostUsd - previousDailyCost;
      const deltaCalls = totalCalls - previousDailyCalls;
      const deltaInput = totalInputTokens - previousDailyInput;
      const deltaOutput = totalOutputTokens - previousDailyOutput;

      await monthlyDocRef.set(
        {
          totalCostUsd: FieldValue.increment(deltaCost),
          totalCalls: FieldValue.increment(deltaCalls),
          totalInputTokens: FieldValue.increment(deltaInput),
          totalOutputTokens: FieldValue.increment(deltaOutput),
          lastUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(
        `Cost summary for tenant ${tenantId} on ${dateStr}: ${totalCalls} calls, $${totalCostUsd.toFixed(4)}`
      );
    }
  }
);
