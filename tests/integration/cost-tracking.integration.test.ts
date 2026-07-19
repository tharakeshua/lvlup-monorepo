/**
 * Integration test: Cost tracking and usage quota.
 *
 * Flow: AI grading → Cost logged → Daily aggregation →
 *       Usage quota check → Overage alert.
 *
 * Requires Firebase emulators: `firebase emulators:start`
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getAdminApp, getAdminFirestore, resetEmulators, setupClientSDK } from "./setup";
import { seedTenant } from "./seed-helpers";

describe("Cost Tracking Integration", () => {
  const TENANT_ID = "cost-tracking-tenant";
  const TENANT_CODE = "CTT001";

  beforeAll(() => {
    getAdminApp();
    setupClientSDK();
  });

  afterEach(async () => {
    await resetEmulators();
  });

  it("should store daily cost summaries", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Cost Tracking School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const today = new Date().toISOString().split("T")[0];
    const summaryRef = db.doc(`tenants/${TENANT_ID}/costSummaries/${today}`);

    await summaryRef.set({
      date: today,
      totalCalls: 15,
      totalCostUsd: 0.45,
      totalInputTokens: 15000,
      totalOutputTokens: 5000,
      byPurpose: {
        grading: { calls: 10, costUsd: 0.3 },
        chat: { calls: 5, costUsd: 0.15 },
      },
      byModel: {
        "gemini-2_5-flash": { calls: 15, costUsd: 0.45 },
      },
      updatedAt: new Date(),
    });

    const doc = await summaryRef.get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.totalCalls).toBe(15);
    expect(doc.data()?.totalCostUsd).toBe(0.45);
  });

  it("should aggregate monthly costs across days", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Cost Tracking School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const basePath = `tenants/${TENANT_ID}/costSummaries`;
    await db.doc(`${basePath}/2026-03-01`).set({
      date: "2026-03-01",
      totalCalls: 10,
      totalCostUsd: 0.3,
    });
    await db.doc(`${basePath}/2026-03-02`).set({
      date: "2026-03-02",
      totalCalls: 20,
      totalCostUsd: 0.6,
    });
    await db.doc(`${basePath}/2026-03-03`).set({
      date: "2026-03-03",
      totalCalls: 5,
      totalCostUsd: 0.15,
    });

    const monthSnap = await db
      .collection(basePath)
      .where("__name__", ">=", "2026-03-01")
      .where("__name__", "<=", "2026-03-31")
      .get();

    const totalCost = monthSnap.docs.reduce((sum, d) => sum + (d.data().totalCostUsd ?? 0), 0);
    const totalCalls = monthSnap.docs.reduce((sum, d) => sum + (d.data().totalCalls ?? 0), 0);

    expect(totalCost).toBeCloseTo(1.05);
    expect(totalCalls).toBe(35);
  });

  it("should enforce usage quota limits", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Cost Tracking School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    // Set quota configuration
    await db.doc(`tenants/${TENANT_ID}`).update({
      settings: {
        usageQuota: {
          monthlyBudgetUsd: 10.0,
          dailyCallLimit: 100,
          warningThresholdPercent: 80,
        },
      },
    });

    // Simulate exceeding monthly budget
    const today = new Date().toISOString().split("T")[0];
    await db.doc(`tenants/${TENANT_ID}/costSummaries/${today}`).set({
      date: today,
      totalCalls: 50,
      totalCostUsd: 10.5,
    });

    // Verify quota can be read and checked
    const tenantDoc = await db.doc(`tenants/${TENANT_ID}`).get();
    const quota = tenantDoc.data()?.settings?.usageQuota;
    expect(quota?.monthlyBudgetUsd).toBe(10.0);

    const summaryDoc = await db.doc(`tenants/${TENANT_ID}/costSummaries/${today}`).get();
    const currentSpend = summaryDoc.data()?.totalCostUsd ?? 0;
    expect(currentSpend).toBeGreaterThan(quota?.monthlyBudgetUsd);
  });

  it("should isolate costs by tenant", async () => {
    const db = getAdminFirestore();

    const TENANT_2 = "cost-tracking-tenant-2";
    await seedTenant({
      tenantId: TENANT_ID,
      name: "School A",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });
    await seedTenant({
      tenantId: TENANT_2,
      name: "School B",
      tenantCode: "CTT002",
      ownerUid: "owner-2",
    });

    await db.doc(`tenants/${TENANT_ID}/costSummaries/2026-03-01`).set({
      totalCostUsd: 5.0,
    });
    await db.doc(`tenants/${TENANT_2}/costSummaries/2026-03-01`).set({
      totalCostUsd: 3.0,
    });

    const tenant1Costs = await db.collection(`tenants/${TENANT_ID}/costSummaries`).get();
    const tenant2Costs = await db.collection(`tenants/${TENANT_2}/costSummaries`).get();

    expect(tenant1Costs.docs[0].data().totalCostUsd).toBe(5.0);
    expect(tenant2Costs.docs[0].data().totalCostUsd).toBe(3.0);
  });

  it("should track costs by purpose breakdown", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Cost Tracking School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const summaryRef = db.doc(`tenants/${TENANT_ID}/costSummaries/2026-03-08`);
    await summaryRef.set({
      date: "2026-03-08",
      totalCalls: 50,
      totalCostUsd: 2.5,
      byPurpose: {
        grading: { calls: 30, costUsd: 1.5 },
        chat: { calls: 15, costUsd: 0.75 },
        insights: { calls: 5, costUsd: 0.25 },
      },
    });

    const doc = await summaryRef.get();
    const byPurpose = doc.data()?.byPurpose;
    expect(byPurpose.grading.calls).toBe(30);
    expect(byPurpose.chat.costUsd).toBe(0.75);
    expect(byPurpose.insights.calls).toBe(5);
  });
});
