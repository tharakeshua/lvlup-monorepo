/**
 * Write validation tests — verify that required fields are enforced,
 * status transitions are validated, and unauthorized writes are rejected.
 *
 * Uses @firebase/rules-unit-testing against the actual firestore.rules.
 * Requires emulators: `firebase emulators:start`
 */
import { describe, it, beforeAll, afterAll, afterEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { EMULATOR_HOST, PORTS, PROJECT_ID } from "../setup";

let testEnv: RulesTestEnvironment;

const T = "tenant1";

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../../../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: PORTS.firestore,
      rules,
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function seed(docPath: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), docPath), data);
  });
}

function superAdmin(): RulesTestContext {
  return testEnv.authenticatedContext("superadmin1");
}

function tenantAdmin(): RulesTestContext {
  return testEnv.authenticatedContext("admin1", {
    tenantId: T,
    role: "tenantAdmin",
  });
}

function student(studentId = "stu1"): RulesTestContext {
  return testEnv.authenticatedContext("student1", {
    tenantId: T,
    role: "student",
    studentId,
    classIds: ["class1"],
  });
}

async function seedSuperAdmin() {
  await seed("users/superadmin1", {
    uid: "superadmin1",
    isSuperAdmin: true,
    status: "active",
  });
}

// ── /users write validations ───────────────────────────────────────────────

describe("/users write validations", () => {
  it("user cannot self-elevate to superAdmin", async () => {
    await seed("users/user1", {
      uid: "user1",
      email: "user@test.com",
      isSuperAdmin: false,
      status: "active",
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(updateDoc(doc(db, "users", "user1"), { isSuperAdmin: true }));
  });

  it("user cannot change own status", async () => {
    await seed("users/user1", {
      uid: "user1",
      email: "user@test.com",
      isSuperAdmin: false,
      status: "active",
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(updateDoc(doc(db, "users", "user1"), { status: "suspended" }));
  });

  it("user cannot modify enrolledSpaceIds in consumerProfile", async () => {
    await seed("users/user1", {
      uid: "user1",
      email: "user@test.com",
      isSuperAdmin: false,
      status: "active",
      consumerProfile: { enrolledSpaceIds: ["space1"] },
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      updateDoc(doc(db, "users", "user1"), {
        consumerProfile: { enrolledSpaceIds: ["space1", "space2"] },
      })
    );
  });

  it("user can update non-sensitive fields", async () => {
    await seed("users/user1", {
      uid: "user1",
      email: "user@test.com",
      displayName: "Old Name",
      isSuperAdmin: false,
      status: "active",
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "user1"), { displayName: "New Name" }));
  });

  it("user cannot create doc for another user", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, "users", "user2"), {
        uid: "user2",
        email: "other@test.com",
        isSuperAdmin: false,
        status: "active",
      })
    );
  });

  it("non-superAdmin cannot delete user doc", async () => {
    await seed("users/user1", {
      uid: "user1",
      email: "user@test.com",
      isSuperAdmin: false,
      status: "active",
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(deleteDoc(doc(db, "users", "user1")));
  });
});

// ── /userMemberships write rejection ───────────────────────────────────────

describe("/userMemberships write rejection", () => {
  it("no client can create memberships", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, "userMemberships", "user1_tenant1"), {
        uid: "user1",
        tenantId: T,
        role: "tenantAdmin",
        status: "active",
      })
    );
  });

  it("superAdmin cannot create memberships (write: false)", async () => {
    await seedSuperAdmin();
    const db = superAdmin().firestore();
    await assertFails(
      setDoc(doc(db, "userMemberships", "superadmin1_tenant1"), {
        uid: "superadmin1",
        tenantId: T,
        role: "tenantAdmin",
        status: "active",
      })
    );
  });

  it("no client can update memberships", async () => {
    await seed("userMemberships/user1_tenant1", {
      uid: "user1",
      tenantId: T,
      role: "student",
      status: "active",
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      updateDoc(doc(db, "userMemberships", "user1_tenant1"), {
        role: "tenantAdmin",
      })
    );
  });

  it("no client can delete memberships", async () => {
    await seed("userMemberships/user1_tenant1", {
      uid: "user1",
      tenantId: T,
      role: "student",
      status: "active",
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(deleteDoc(doc(db, "userMemberships", "user1_tenant1")));
  });
});

// ── /tenantCodes write rejection ───────────────────────────────────────────

describe("/tenantCodes write rejection", () => {
  it("no client can create tenant codes", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(setDoc(doc(db, "tenantCodes", "HACK01"), { tenantId: "evil" }));
  });

  it("superAdmin cannot create tenant codes (write: false)", async () => {
    await seedSuperAdmin();
    const db = superAdmin().firestore();
    await assertFails(setDoc(doc(db, "tenantCodes", "SA001"), { tenantId: T }));
  });
});

// ── /tenants/{tenantId}/notifications write validation ─────────────────────

describe("/tenants/{tenantId}/notifications write validation", () => {
  it("user can only update own notification read status", async () => {
    await seed(`tenants/${T}/notifications/notif1`, {
      recipientId: "student1",
      title: "Test",
      isRead: false,
    });

    const db = student("stu1").firestore();
    await assertSucceeds(
      updateDoc(doc(db, `tenants/${T}/notifications`, "notif1"), {
        isRead: true,
        readAt: new Date().toISOString(),
      })
    );
  });

  it("user cannot update another user notification", async () => {
    await seed(`tenants/${T}/notifications/notif2`, {
      recipientId: "student2",
      title: "Test",
      isRead: false,
    });

    const db = student("stu1").firestore();
    await assertFails(updateDoc(doc(db, `tenants/${T}/notifications`, "notif2"), { isRead: true }));
  });

  it("user cannot update notification fields other than isRead/readAt", async () => {
    await seed(`tenants/${T}/notifications/notif1`, {
      recipientId: "student1",
      title: "Test",
      body: "Original body",
      isRead: false,
    });

    const db = student("stu1").firestore();
    await assertFails(
      updateDoc(doc(db, `tenants/${T}/notifications`, "notif1"), {
        title: "Hacked Title",
      })
    );
  });

  it("no client can create notifications", async () => {
    const db = student("stu1").firestore();
    await assertFails(
      setDoc(doc(db, `tenants/${T}/notifications`, "newNotif"), {
        recipientId: "student1",
        title: "Fake",
      })
    );
  });

  it("no client can delete notifications", async () => {
    await seed(`tenants/${T}/notifications/notif1`, {
      recipientId: "student1",
      title: "Test",
      isRead: false,
    });

    const db = student("stu1").firestore();
    await assertFails(deleteDoc(doc(db, `tenants/${T}/notifications`, "notif1")));
  });
});

// ── /tenants/{tenantId}/notificationPreferences write validation ───────────

describe("/tenants/{tenantId}/notificationPreferences write validation", () => {
  it("user can write own notification preferences", async () => {
    const db = student("stu1").firestore();
    await assertSucceeds(
      setDoc(doc(db, `tenants/${T}/notificationPreferences`, "student1"), {
        emailEnabled: true,
        pushEnabled: false,
      })
    );
  });

  it("user cannot write another user preferences", async () => {
    const db = student("stu1").firestore();
    await assertFails(
      setDoc(doc(db, `tenants/${T}/notificationPreferences`, "student2"), {
        emailEnabled: true,
      })
    );
  });
});

// ── /llmCallLogs write rejection (Cloud Functions only) ────────────────────

describe("/tenants/{tenantId}/llmCallLogs write rejection", () => {
  it("tenantAdmin cannot write llm call logs", async () => {
    const db = tenantAdmin().firestore();
    await assertFails(
      setDoc(doc(db, `tenants/${T}/llmCallLogs`, "log1"), {
        tokens: 100,
        model: "gemini-pro",
      })
    );
  });
});

// ── /scanners write rejection (Cloud Functions only) ───────────────────────

describe("/scanners write rejection", () => {
  it("no client can write scanner docs", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, "scanners", "scanner1"), {
        authUid: "user1",
        tenantId: T,
      })
    );
  });
});

// ── /answer keys write rejection (Admin SDK only) ──────────────────────────

describe("answer keys write rejection", () => {
  it("no client can read or write answer keys", async () => {
    await seed(`tenants/${T}/spaces/space1/items/item1/answerKeys/key1`, {
      answer: "secret",
    });

    // Even superAdmin cannot read answer keys via client
    await seedSuperAdmin();
    const db = superAdmin().firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/spaces/space1/items/item1/answerKeys`, "key1")));

    // Cannot write either
    await assertFails(
      setDoc(doc(db, `tenants/${T}/spaces/space1/items/item1/answerKeys`, "key2"), {
        answer: "hack",
      })
    );
  });
});

// ── Unauthenticated access ─────────────────────────────────────────────────

describe("unauthenticated access", () => {
  it("unauthenticated can read tenants (public read)", async () => {
    await seed(`tenants/${T}`, { id: T, name: "School", status: "active" });

    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "tenants", T)));
  });

  it("unauthenticated can read tenant codes", async () => {
    await seed("tenantCodes/TST001", { tenantId: T });

    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "tenantCodes", "TST001")));
  });

  it("unauthenticated cannot read users", async () => {
    await seed("users/user1", { uid: "user1", status: "active" });

    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users", "user1")));
  });

  it("unauthenticated cannot write to any collection", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "tenants", "hack"), { name: "Evil" }));
    await assertFails(setDoc(doc(db, `tenants/${T}/students`, "hack"), { name: "Evil" }));
  });
});

// ── globalEvaluationPresets ────────────────────────────────────────────────

describe("/globalEvaluationPresets write validation", () => {
  it("any authenticated user can read presets", async () => {
    await seed("globalEvaluationPresets/preset1", { name: "Default", config: {} });

    const db = testEnv.authenticatedContext("randomUser").firestore();
    await assertSucceeds(getDoc(doc(db, "globalEvaluationPresets", "preset1")));
  });

  it("non-superAdmin cannot write presets", async () => {
    const db = tenantAdmin().firestore();
    await assertFails(setDoc(doc(db, "globalEvaluationPresets", "preset1"), { name: "Hack" }));
  });

  it("superAdmin can write presets", async () => {
    await seedSuperAdmin();
    const db = superAdmin().firestore();
    await assertSucceeds(
      setDoc(doc(db, "globalEvaluationPresets", "preset1"), { name: "New Preset" })
    );
  });
});
