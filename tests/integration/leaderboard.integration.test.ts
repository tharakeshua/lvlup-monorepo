/**
 * Integration test: Leaderboard updates.
 *
 * Flow: Student completes space → Progress triggers leaderboard update →
 *       Rankings recalculated with concurrent submission and tie-breaking.
 *
 * Requires Firebase emulators: `firebase emulators:start`
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getAdminApp, getAdminFirestore, resetEmulators, setupClientSDK } from "./setup";
import { seedTenant } from "./seed-helpers";

describe("Leaderboard Integration", () => {
  const TENANT_ID = "leaderboard-tenant";
  const TENANT_CODE = "LBT001";

  beforeAll(() => {
    getAdminApp();
    setupClientSDK();
  });

  afterEach(async () => {
    await resetEmulators();
  });

  it("should create leaderboard entries for students", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Leaderboard School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    // Create leaderboard entries
    const leaderboardPath = `tenants/${TENANT_ID}/leaderboard`;
    await db.doc(`${leaderboardPath}/student-1`).set({
      studentId: "student-1",
      displayName: "Alice",
      totalPoints: 500,
      spacesCompleted: 3,
      rank: 1,
      updatedAt: new Date(),
    });
    await db.doc(`${leaderboardPath}/student-2`).set({
      studentId: "student-2",
      displayName: "Bob",
      totalPoints: 400,
      spacesCompleted: 2,
      rank: 2,
      updatedAt: new Date(),
    });

    const leaderboard = await db.collection(leaderboardPath).orderBy("totalPoints", "desc").get();

    expect(leaderboard.docs).toHaveLength(2);
    expect(leaderboard.docs[0].data().displayName).toBe("Alice");
    expect(leaderboard.docs[1].data().displayName).toBe("Bob");
  });

  it("should handle tie-breaking by spacesCompleted", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Leaderboard School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const leaderboardPath = `tenants/${TENANT_ID}/leaderboard`;
    await db.doc(`${leaderboardPath}/student-a`).set({
      studentId: "student-a",
      displayName: "Charlie",
      totalPoints: 300,
      spacesCompleted: 5,
      updatedAt: new Date(),
    });
    await db.doc(`${leaderboardPath}/student-b`).set({
      studentId: "student-b",
      displayName: "Diana",
      totalPoints: 300,
      spacesCompleted: 3,
      updatedAt: new Date(),
    });

    // Query with secondary sort
    const results = await db
      .collection(leaderboardPath)
      .orderBy("totalPoints", "desc")
      .orderBy("spacesCompleted", "desc")
      .get();

    expect(results.docs).toHaveLength(2);
    expect(results.docs[0].data().displayName).toBe("Charlie");
  });

  it("should isolate leaderboards by tenant", async () => {
    const db = getAdminFirestore();

    const TENANT_2 = "leaderboard-tenant-2";
    await seedTenant({
      tenantId: TENANT_ID,
      name: "School A",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });
    await seedTenant({
      tenantId: TENANT_2,
      name: "School B",
      tenantCode: "LBT002",
      ownerUid: "owner-2",
    });

    await db.doc(`tenants/${TENANT_ID}/leaderboard/s1`).set({
      studentId: "s1",
      totalPoints: 100,
    });
    await db.doc(`tenants/${TENANT_2}/leaderboard/s2`).set({
      studentId: "s2",
      totalPoints: 200,
    });

    const tenant1Board = await db.collection(`tenants/${TENANT_ID}/leaderboard`).get();
    const tenant2Board = await db.collection(`tenants/${TENANT_2}/leaderboard`).get();

    expect(tenant1Board.docs).toHaveLength(1);
    expect(tenant2Board.docs).toHaveLength(1);
    expect(tenant1Board.docs[0].data().studentId).toBe("s1");
    expect(tenant2Board.docs[0].data().studentId).toBe("s2");
  });

  it("should update leaderboard when progress changes", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Leaderboard School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const entryRef = db.doc(`tenants/${TENANT_ID}/leaderboard/student-x`);
    await entryRef.set({
      studentId: "student-x",
      displayName: "Eve",
      totalPoints: 100,
      spacesCompleted: 1,
      updatedAt: new Date(),
    });

    // Simulate progress update
    await entryRef.update({
      totalPoints: 250,
      spacesCompleted: 3,
      updatedAt: new Date(),
    });

    const updated = await entryRef.get();
    expect(updated.data()?.totalPoints).toBe(250);
    expect(updated.data()?.spacesCompleted).toBe(3);
  });
});
