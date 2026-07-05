"use strict";
/**
 * dailyCostAggregation — Cloud Scheduler function that runs at 1:00 AM daily.
 * Aggregates LLM call logs from the previous day into a DailyCostSummary
 * document and checks budget limits.
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyCostAggregation = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const domain_1 = require("@levelup/domain");
const BUDGET_WARNING_THRESHOLD = 0.8; // 80%
const BUDGET_EXCEEDED_THRESHOLD = 1.0; // 100%
exports.dailyCostAggregation = (0, scheduler_1.onSchedule)(
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
    const startTimestamp = firestore_1.Timestamp.fromDate(startOfDay);
    const endTimestamp = firestore_1.Timestamp.fromDate(endOfDay);
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
      const byPurpose = {};
      const byModel = {};
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
        const purpose = log.purpose ?? "unknown";
        if (!byPurpose[purpose]) {
          byPurpose[purpose] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
        }
        byPurpose[purpose].calls++;
        byPurpose[purpose].inputTokens += input;
        byPurpose[purpose].outputTokens += output;
        byPurpose[purpose].costUsd += cost;
        // By model
        const model = log.model ?? "unknown";
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
      const budgetLimitUsd = tenantData.subscription?.monthlyBudgetUsd;
      let budgetUsedPercent;
      let budgetAlertSent = false;
      if (budgetLimitUsd && budgetLimitUsd > 0) {
        // Get monthly total so far. Canonical path shape: ONE costSummaries
        // collection with prefixed doc ids (daily_YYYY-MM-DD / monthly_YYYY-MM) —
        // the old nested daily/monthly sub-paths had invalid segment counts and
        // threw at runtime.
        const monthStr = dateStr.substring(0, 7); // YYYY-MM
        const monthlySummarySnap = await db
          .doc(`tenants/${tenantId}/costSummaries/monthly_${monthStr}`)
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
      const costSummary = {
        id: `daily_${dateStr}`, // mirrors the doc id (prefixed convention)
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
        computedAt: (0, domain_1.isoNow)(), // B8: ISO strings are canonical at rest
      };
      const dailyDocRef = db.doc(`tenants/${tenantId}/costSummaries/daily_${dateStr}`);
      const monthStr = dateStr.substring(0, 7);
      const monthlyDocRef = db.doc(`tenants/${tenantId}/costSummaries/monthly_${monthStr}`);
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
          totalCostUsd: firestore_1.FieldValue.increment(deltaCost),
          totalCalls: firestore_1.FieldValue.increment(deltaCalls),
          totalInputTokens: firestore_1.FieldValue.increment(deltaInput),
          totalOutputTokens: firestore_1.FieldValue.increment(deltaOutput),
          lastUpdatedAt: (0, domain_1.isoNow)(), // B8: ISO strings are canonical at rest
        },
        { merge: true }
      );
      console.log(
        `Cost summary for tenant ${tenantId} on ${dateStr}: ${totalCalls} calls, $${totalCostUsd.toFixed(4)}`
      );
    }
  }
);
//# sourceMappingURL=daily-cost-aggregation.js.map
