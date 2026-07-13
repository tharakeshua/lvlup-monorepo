/**
 * Integration tests for membership-service.ts
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
import { getUserMemberships, getMembership } from "../auth/membership-service";

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

function membershipData(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user1",
    tenantId: "tenant1",
    tenantCode: "TST001",
    role: "student",
    status: "active",
    joinSource: "admin_created",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...overrides,
  };
}

describe("getUserMemberships", () => {
  it("returns empty array when user has no memberships", async () => {
    const result = await getUserMemberships("nonexistent-uid");
    expect(result).toEqual([]);
  });

  it("returns only active memberships for the given uid", async () => {
    const db = getDb();

    // Active membership
    await db.doc("userMemberships/user1_tenant1").set(membershipData({ id: "user1_tenant1" }));

    // Inactive membership (should be excluded)
    await db.doc("userMemberships/user1_tenant2").set(
      membershipData({
        id: "user1_tenant2",
        tenantId: "tenant2",
        status: "inactive",
      })
    );

    // Another user's membership (should be excluded)
    await db.doc("userMemberships/user2_tenant1").set(
      membershipData({
        id: "user2_tenant1",
        uid: "user2",
      })
    );

    const result = await getUserMemberships("user1");
    expect(result).toHaveLength(1);
    expect(result[0]!.tenantId).toBe("tenant1");
    expect(result[0]!.status).toBe("active");
  });

  it("returns multiple active memberships", async () => {
    const db = getDb();

    await db
      .doc("userMemberships/user1_tenantA")
      .set(membershipData({ id: "user1_tenantA", tenantId: "tenantA" }));
    await db.doc("userMemberships/user1_tenantB").set(
      membershipData({
        id: "user1_tenantB",
        tenantId: "tenantB",
        role: "teacher",
      })
    );

    const result = await getUserMemberships("user1");
    expect(result).toHaveLength(2);
  });
});

describe("getMembership", () => {
  it("returns null when membership does not exist", async () => {
    const result = await getMembership("nobody", "nowhere");
    expect(result).toBeNull();
  });

  it("returns the membership document for an existing composite key", async () => {
    const db = getDb();

    await db.doc("userMemberships/user1_tenant1").set(membershipData({ id: "user1_tenant1" }));

    const result = await getMembership("user1", "tenant1");
    expect(result).not.toBeNull();
    expect(result!.uid).toBe("user1");
    expect(result!.tenantId).toBe("tenant1");
    expect(result!.role).toBe("student");
  });
});
