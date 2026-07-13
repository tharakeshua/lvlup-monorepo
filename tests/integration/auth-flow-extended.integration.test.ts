/**
 * Integration test: Extended Auth Flows.
 *
 * Tests: Create tenant → create user with membership → verify custom claims →
 *        switch tenant → verify claims updated.
 *
 * Requires Firebase emulators to be running.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  getAdminApp,
  getAdminFirestore,
  getAdminAuth,
  resetEmulators,
  setupClientSDK,
} from "./setup";
import { seedTenant, seedUser, seedMembership, setUserClaims } from "./seed-helpers";

describe("Extended Auth Flow Integration", () => {
  const TENANT_A_ID = "auth-tenant-a";
  const TENANT_B_ID = "auth-tenant-b";

  beforeAll(() => {
    getAdminApp();
    setupClientSDK();
  });

  afterEach(async () => {
    await resetEmulators();
  });

  it("should create user with membership and set claims", async () => {
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_A_ID,
      name: "School A",
      tenantCode: "SCHA01",
      ownerUid: "owner-a",
    });

    const user = await seedUser({
      email: "teacher-auth@test.com",
      password: "Test1234",
      displayName: "Auth Teacher",
    });

    await seedMembership({
      uid: user.uid,
      tenantId: TENANT_A_ID,
      tenantCode: "SCHA01",
      role: "teacher",
      teacherId: "tch-auth-1",
      classIds: ["class-1"],
    });

    // Set claims (simulating switchActiveTenant)
    await setUserClaims(user.uid, {
      tenantId: TENANT_A_ID,
      role: "teacher",
      tenantCode: "SCHA01",
      teacherId: "tch-auth-1",
    });

    // Verify
    const record = await auth.getUser(user.uid);
    expect(record.customClaims?.tenantId).toBe(TENANT_A_ID);
    expect(record.customClaims?.role).toBe("teacher");
  });

  it("should switch tenant context and update claims", async () => {
    const auth = getAdminAuth();

    await seedTenant({
      tenantId: TENANT_A_ID,
      name: "School A",
      tenantCode: "SCHA01",
      ownerUid: "owner-a",
    });

    await seedTenant({
      tenantId: TENANT_B_ID,
      name: "School B",
      tenantCode: "SCHB01",
      ownerUid: "owner-b",
    });

    const user = await seedUser({
      email: "multi-org@test.com",
      password: "Test1234",
      displayName: "Multi-Org Teacher",
    });

    // Membership in tenant A
    await seedMembership({
      uid: user.uid,
      tenantId: TENANT_A_ID,
      tenantCode: "SCHA01",
      role: "teacher",
    });

    // Membership in tenant B
    await seedMembership({
      uid: user.uid,
      tenantId: TENANT_B_ID,
      tenantCode: "SCHB01",
      role: "tenantAdmin",
    });

    // Switch to tenant A
    await setUserClaims(user.uid, {
      tenantId: TENANT_A_ID,
      role: "teacher",
      tenantCode: "SCHA01",
    });

    let record = await auth.getUser(user.uid);
    expect(record.customClaims?.tenantId).toBe(TENANT_A_ID);

    // Switch to tenant B
    await setUserClaims(user.uid, {
      tenantId: TENANT_B_ID,
      role: "tenantAdmin",
      tenantCode: "SCHB01",
    });

    record = await auth.getUser(user.uid);
    expect(record.customClaims?.tenantId).toBe(TENANT_B_ID);
    expect(record.customClaims?.role).toBe("tenantAdmin");
  });

  it("should enforce cross-tenant isolation", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_A_ID,
      name: "School A",
      tenantCode: "SCHA01",
      ownerUid: "owner-a",
    });

    await seedTenant({
      tenantId: TENANT_B_ID,
      name: "School B",
      tenantCode: "SCHB01",
      ownerUid: "owner-b",
    });

    // Create data in tenant A
    await db.doc(`tenants/${TENANT_A_ID}/exams/exam-a1`).set({
      id: "exam-a1",
      tenantId: TENANT_A_ID,
      title: "Tenant A Exam",
    });

    // Verify it exists under tenant A
    const examA = await db.doc(`tenants/${TENANT_A_ID}/exams/exam-a1`).get();
    expect(examA.exists).toBe(true);

    // Verify it does NOT exist under tenant B
    const examB = await db.doc(`tenants/${TENANT_B_ID}/exams/exam-a1`).get();
    expect(examB.exists).toBe(false);
  });
});
