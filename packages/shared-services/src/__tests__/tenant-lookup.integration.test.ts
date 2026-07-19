/**
 * Integration tests for tenant-lookup.ts
 * Requires Firebase Emulators running: `firebase emulators:start`
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import * as admin from "firebase-admin";
import {
  setupEmulators,
  getAdminFirestore,
  resetEmulators,
  signInAsSuperAdmin,
} from "./emulator-setup";
import { lookupTenantByCode, deriveStudentEmail } from "../auth/tenant-lookup";

beforeAll(() => {
  setupEmulators();
});

beforeEach(async () => {
  await signInAsSuperAdmin();
});

afterEach(async () => {
  await resetEmulators();
});

function getDb() {
  return getAdminFirestore();
}

describe("lookupTenantByCode", () => {
  it("returns null for a non-existent code", async () => {
    const result = await lookupTenantByCode("DOESNOTEXIST");
    expect(result).toBeNull();
  });

  it("resolves a valid tenant code to the full tenant document", async () => {
    const db = getDb();

    // Seed tenantCodes and tenants using Admin SDK
    await db.doc("tenantCodes/SPR001").set({
      tenantId: "tenant-abc",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc("tenants/tenant-abc").set({
      id: "tenant-abc",
      name: "Springfield School",
      slug: "springfield-school",
      tenantCode: "SPR001",
      ownerUid: "owner1",
      contactEmail: "admin@springfield.edu",
      status: "active",
      subscription: { plan: "trial" },
      features: { autoGradeEnabled: true, levelUpEnabled: true },
      settings: { geminiKeySet: false },
      stats: { totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalSpaces: 0, totalExams: 0 },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tenant = await lookupTenantByCode("spr001"); // lowercase input
    expect(tenant).not.toBeNull();
    expect(tenant!.id).toBe("tenant-abc");
    expect(tenant!.name).toBe("Springfield School");
    expect(tenant!.tenantCode).toBe("SPR001");
  });

  it("returns null when tenant code exists but tenant doc is missing", async () => {
    const db = getDb();
    await db.doc("tenantCodes/ORPHAN").set({
      tenantId: "nonexistent-tenant",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const result = await lookupTenantByCode("ORPHAN");
    expect(result).toBeNull();
  });
});

describe("deriveStudentEmail", () => {
  it("sanitises roll number and builds internal email", () => {
    expect(deriveStudentEmail("STU-001", "tenant-abc")).toBe("stu-001@tenant-abc.levelup.internal");
  });

  it("strips special characters", () => {
    expect(deriveStudentEmail("Roll #42!", "tid")).toBe("roll42@tid.levelup.internal");
  });

  it("handles already-clean roll numbers", () => {
    expect(deriveStudentEmail("abc123", "tid")).toBe("abc123@tid.levelup.internal");
  });
});
