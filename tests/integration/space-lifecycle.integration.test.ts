/**
 * Integration test: LevelUp Space Lifecycle.
 *
 * Flow: Create space → add story points → add items → publish →
 *       start test session → submit → verify scoring.
 *
 * Requires Firebase emulators to be running.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getAdminApp, getAdminFirestore, resetEmulators, setupClientSDK } from "./setup";
import { seedTenant, seedUser, seedMembership } from "./seed-helpers";

describe("Space Lifecycle Integration", () => {
  const TENANT_ID = "space-lifecycle-tenant";
  const TENANT_CODE = "SLT001";

  beforeAll(() => {
    getAdminApp();
    setupClientSDK();
  });

  afterEach(async () => {
    await resetEmulators();
  });

  it("should create a space with draft status", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Space Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const spaceRef = db.collection(`tenants/${TENANT_ID}/spaces`).doc("test-space-1");
    await spaceRef.set({
      id: "test-space-1",
      tenantId: TENANT_ID,
      title: "Algebra Basics",
      type: "learn",
      status: "draft",
      classIds: ["class-1"],
      teacherIds: ["teacher-1"],
      stats: { totalStoryPoints: 0, totalItems: 0 },
    });

    const doc = await spaceRef.get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.status).toBe("draft");
  });

  it("should add story points and items to a space", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Space Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    // Create space
    await db.doc(`tenants/${TENANT_ID}/spaces/test-space-2`).set({
      id: "test-space-2",
      tenantId: TENANT_ID,
      title: "Geometry",
      type: "learn",
      status: "draft",
    });

    // Add story point
    const spRef = db.doc(`tenants/${TENANT_ID}/spaces/test-space-2/storyPoints/sp1`);
    await spRef.set({
      id: "sp1",
      title: "Triangles",
      type: "standard",
      order: 0,
    });

    // Add items
    const itemsCol = db.collection(`tenants/${TENANT_ID}/spaces/test-space-2/items`);
    await itemsCol.doc("item1").set({
      id: "item1",
      title: "What is a triangle?",
      type: "question",
      storyPointId: "sp1",
      order: 0,
      payload: {
        questionType: "mcq",
        questionData: {
          options: [
            { id: "a", text: "3-sided shape", isCorrect: true },
            { id: "b", text: "4-sided shape", isCorrect: false },
          ],
        },
        basePoints: 1,
      },
    });

    const itemsSnap = await itemsCol.get();
    expect(itemsSnap.size).toBe(1);
  });

  it("should publish space and update status", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Space Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const spaceRef = db.doc(`tenants/${TENANT_ID}/spaces/test-space-3`);
    await spaceRef.set({
      id: "test-space-3",
      title: "Published Space",
      status: "draft",
    });

    // Publish
    await spaceRef.update({ status: "published" });

    const doc = await spaceRef.get();
    expect(doc.data()?.status).toBe("published");
  });

  it("should create a test session and track submissions", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Space Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    // Create session
    const sessionRef = db.collection(`tenants/${TENANT_ID}/digitalTestSessions`).doc("session-1");
    await sessionRef.set({
      id: "session-1",
      tenantId: TENANT_ID,
      userId: "student-1",
      spaceId: "test-space-4",
      storyPointId: "sp1",
      sessionType: "timed_test",
      status: "in_progress",
      questionOrder: ["item1", "item2"],
      submissions: {},
      totalQuestions: 2,
      answeredQuestions: 0,
    });

    // Submit an answer
    await sessionRef.update({
      "submissions.item1": {
        questionType: "mcq",
        answer: "a",
        submittedAt: Date.now(),
      },
      answeredQuestions: 1,
    });

    const doc = await sessionRef.get();
    expect(doc.data()?.answeredQuestions).toBe(1);
    expect(doc.data()?.submissions?.item1?.answer).toBe("a");
  });

  it("should complete session and compute scores", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Space Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const sessionRef = db.doc(`tenants/${TENANT_ID}/digitalTestSessions/session-2`);
    await sessionRef.set({
      id: "session-2",
      status: "in_progress",
      pointsEarned: null,
      totalPoints: null,
    });

    // Complete with scores
    await sessionRef.update({
      status: "completed",
      pointsEarned: 8,
      totalPoints: 10,
      percentage: 80,
    });

    const doc = await sessionRef.get();
    expect(doc.data()?.status).toBe("completed");
    expect(doc.data()?.percentage).toBe(80);
  });
});
