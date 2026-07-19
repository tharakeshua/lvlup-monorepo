/**
 * Firestore Security Rules tests using @firebase/rules-unit-testing.
 *
 * Covers all identity-layer collections as specified in §10.2 of the design doc.
 * Requires emulators: `firebase emulators:start`
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { EMULATOR_HOST, PORTS, PROJECT_ID } from "./setup";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../../firestore.rules");
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

// ---------------------------------------------------------------------------
// Helper: create authenticated context with custom claims
// ---------------------------------------------------------------------------

function authedUser(uid: string, claims: Record<string, unknown> = {}): RulesTestContext {
  return testEnv.authenticatedContext(uid, claims);
}

function unauthenticated(): RulesTestContext {
  return testEnv.unauthenticatedContext();
}

// ---------------------------------------------------------------------------
// Seed data helpers (admin bypass)
// ---------------------------------------------------------------------------

async function seedViaAdmin(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, path), data);
  });
}

// ══════════════════════════════════════════════════════════════════════════
// /users/{uid}
// ══════════════════════════════════════════════════════════════════════════

describe("/users/{uid}", () => {
  const userData = {
    uid: "user1",
    email: "user1@test.com",
    displayName: "User One",
    isSuperAdmin: false,
    status: "active",
    authProviders: ["email"],
  };

  const superAdminData = {
    uid: "admin1",
    email: "admin@test.com",
    displayName: "Admin",
    isSuperAdmin: true,
    status: "active",
    authProviders: ["email"],
  };

  it("user can read own doc", async () => {
    await seedViaAdmin("users/user1", userData);
    const db = authedUser("user1").firestore();
    await assertSucceeds(getDoc(doc(db, "users", "user1")));
  });

  it("user cannot read another user doc", async () => {
    await seedViaAdmin("users/user2", { ...userData, uid: "user2" });
    const db = authedUser("user1").firestore();
    await assertFails(getDoc(doc(db, "users", "user2")));
  });

  it("superAdmin can read any user doc", async () => {
    await seedViaAdmin("users/admin1", superAdminData);
    await seedViaAdmin("users/user1", userData);
    const db = authedUser("admin1").firestore();
    await assertSucceeds(getDoc(doc(db, "users", "user1")));
  });

  it("user can update own doc (non-sensitive fields)", async () => {
    await seedViaAdmin("users/user1", userData);
    const db = authedUser("user1").firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "user1"), { displayName: "Updated Name" }));
  });

  it("user cannot set isSuperAdmin to true", async () => {
    await seedViaAdmin("users/user1", userData);
    const db = authedUser("user1").firestore();
    await assertFails(updateDoc(doc(db, "users", "user1"), { isSuperAdmin: true }));
  });

  it("user cannot change own status", async () => {
    await seedViaAdmin("users/user1", userData);
    const db = authedUser("user1").firestore();
    await assertFails(updateDoc(doc(db, "users", "user1"), { status: "suspended" }));
  });

  it("superAdmin can delete user doc", async () => {
    await seedViaAdmin("users/admin1", superAdminData);
    await seedViaAdmin("users/user1", userData);
    const db = authedUser("admin1").firestore();
    await assertSucceeds(deleteDoc(doc(db, "users", "user1")));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// /userMemberships/{id}
// ══════════════════════════════════════════════════════════════════════════

describe("/userMemberships/{id}", () => {
  const membership = {
    uid: "user1",
    tenantId: "tenant1",
    tenantCode: "TST001",
    role: "student",
    status: "active",
  };

  const superAdminUserDoc = {
    uid: "admin1",
    isSuperAdmin: true,
    status: "active",
  };

  it("user can read own membership", async () => {
    await seedViaAdmin("userMemberships/user1_tenant1", membership);
    const db = authedUser("user1").firestore();
    await assertSucceeds(getDoc(doc(db, "userMemberships", "user1_tenant1")));
  });

  it("user cannot read another user membership", async () => {
    await seedViaAdmin("userMemberships/user2_tenant1", {
      ...membership,
      uid: "user2",
    });
    const db = authedUser("user1").firestore();
    await assertFails(getDoc(doc(db, "userMemberships", "user2_tenant1")));
  });

  it("superAdmin can read any membership", async () => {
    await seedViaAdmin("users/admin1", superAdminUserDoc);
    await seedViaAdmin("userMemberships/user1_tenant1", membership);
    const db = authedUser("admin1").firestore();
    await assertSucceeds(getDoc(doc(db, "userMemberships", "user1_tenant1")));
  });

  it("user cannot write to memberships (any operation)", async () => {
    await seedViaAdmin("userMemberships/user1_tenant1", membership);
    const db = authedUser("user1").firestore();

    await assertFails(
      setDoc(doc(db, "userMemberships", "user1_tenantX"), {
        uid: "user1",
        tenantId: "tenantX",
        role: "tenantAdmin",
        status: "active",
      })
    );
    await assertFails(
      updateDoc(doc(db, "userMemberships", "user1_tenant1"), {
        role: "tenantAdmin",
      })
    );
    await assertFails(deleteDoc(doc(db, "userMemberships", "user1_tenant1")));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// /tenants/{tenantId}
// ══════════════════════════════════════════════════════════════════════════

describe("/tenants/{tenantId}", () => {
  const tenantDoc = {
    id: "tenant1",
    name: "Test School",
    status: "active",
    tenantCode: "TST001",
  };

  const superAdminUserDoc = {
    uid: "admin1",
    isSuperAdmin: true,
    status: "active",
  };

  it("active member can read tenant", async () => {
    await seedViaAdmin("tenants/tenant1", tenantDoc);
    await seedViaAdmin("userMemberships/user1_tenant1", {
      uid: "user1",
      tenantId: "tenant1",
      status: "active",
      role: "student",
    });
    const db = authedUser("user1", {
      tenantId: "tenant1",
      role: "student",
    }).firestore();
    await assertSucceeds(getDoc(doc(db, "tenants", "tenant1")));
  });

  it("non-member cannot read tenant", async () => {
    await seedViaAdmin("tenants/tenant1", tenantDoc);
    const db = authedUser("stranger").firestore();
    await assertFails(getDoc(doc(db, "tenants", "tenant1")));
  });

  it("tenantAdmin can update tenant", async () => {
    await seedViaAdmin("tenants/tenant1", tenantDoc);
    const db = authedUser("user1", {
      tenantId: "tenant1",
      role: "tenantAdmin",
    }).firestore();
    await assertSucceeds(updateDoc(doc(db, "tenants", "tenant1"), { name: "Updated School" }));
  });

  it("teacher cannot update tenant", async () => {
    await seedViaAdmin("tenants/tenant1", tenantDoc);
    await seedViaAdmin("userMemberships/teacher1_tenant1", {
      uid: "teacher1",
      tenantId: "tenant1",
      status: "active",
      role: "teacher",
    });
    const db = authedUser("teacher1", {
      tenantId: "tenant1",
      role: "teacher",
    }).firestore();
    await assertFails(updateDoc(doc(db, "tenants", "tenant1"), { name: "Hacked" }));
  });

  it("superAdmin can CRUD tenants", async () => {
    await seedViaAdmin("users/admin1", superAdminUserDoc);
    await seedViaAdmin("tenants/tenant1", tenantDoc);

    const db = authedUser("admin1").firestore();

    // Read
    await assertSucceeds(getDoc(doc(db, "tenants", "tenant1")));
    // Update
    await assertSucceeds(updateDoc(doc(db, "tenants", "tenant1"), { name: "New Name" }));
    // Create
    await assertSucceeds(setDoc(doc(db, "tenants", "tenant2"), { ...tenantDoc, id: "tenant2" }));
    // Delete
    await assertSucceeds(deleteDoc(doc(db, "tenants", "tenant1")));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// /tenantCodes/{code}
// ══════════════════════════════════════════════════════════════════════════

describe("/tenantCodes/{code}", () => {
  it("anyone (even unauthenticated) can read tenant codes", async () => {
    await seedViaAdmin("tenantCodes/SPR001", {
      tenantId: "tenant1",
    });

    // Unauthenticated
    const unauthedDb = unauthenticated().firestore();
    await assertSucceeds(getDoc(doc(unauthedDb, "tenantCodes", "SPR001")));

    // Authenticated
    const authedDb = authedUser("user1").firestore();
    await assertSucceeds(getDoc(doc(authedDb, "tenantCodes", "SPR001")));
  });

  it("no client can write tenant codes", async () => {
    const db = authedUser("user1").firestore();
    await assertFails(setDoc(doc(db, "tenantCodes", "HACK01"), { tenantId: "evil" }));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// /tenants/{tenantId}/students/{studentId}
// ══════════════════════════════════════════════════════════════════════════

describe("/tenants/{tenantId}/students/{studentId}", () => {
  const studentDoc = {
    id: "stu1",
    tenantId: "tenant1",
    authUid: "studentUser1",
    firstName: "John",
    lastName: "Doe",
    rollNumber: "001",
    status: "active",
  };

  const superAdminUserDoc = {
    uid: "admin1",
    isSuperAdmin: true,
    status: "active",
  };

  it("tenantAdmin can CRUD students", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu1", studentDoc);
    const db = authedUser("adminUser", {
      tenantId: "tenant1",
      role: "tenantAdmin",
    }).firestore();

    await assertSucceeds(getDoc(doc(db, "tenants/tenant1/students", "stu1")));
    await assertSucceeds(
      updateDoc(doc(db, "tenants/tenant1/students", "stu1"), {
        firstName: "Jane",
      })
    );
    await assertSucceeds(deleteDoc(doc(db, "tenants/tenant1/students", "stu1")));
  });

  it("teacher can read students in their tenant", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu1", studentDoc);
    const db = authedUser("teacherUser", {
      tenantId: "tenant1",
      role: "teacher",
      teacherId: "tch1",
    }).firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/tenant1/students", "stu1")));
  });

  it("student can read own doc", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu1", studentDoc);
    const db = authedUser("studentUser1", {
      tenantId: "tenant1",
      role: "student",
      studentId: "stu1",
    }).firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/tenant1/students", "stu1")));
  });

  it("student cannot read another student", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu2", {
      ...studentDoc,
      id: "stu2",
      authUid: "studentUser2",
    });
    const db = authedUser("studentUser1", {
      tenantId: "tenant1",
      role: "student",
      studentId: "stu1",
    }).firestore();
    await assertFails(getDoc(doc(db, "tenants/tenant1/students", "stu2")));
  });

  it("student cannot update any student", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu1", studentDoc);
    const db = authedUser("studentUser1", {
      tenantId: "tenant1",
      role: "student",
      studentId: "stu1",
    }).firestore();
    await assertFails(
      updateDoc(doc(db, "tenants/tenant1/students", "stu1"), {
        firstName: "Hacked",
      })
    );
  });

  it("parent can read linked student", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu1", studentDoc);
    const db = authedUser("parentUser", {
      tenantId: "tenant1",
      role: "parent",
      parentId: "par1",
      studentIds: ["stu1"],
    }).firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/tenant1/students", "stu1")));
  });

  it("parent cannot read unlinked student", async () => {
    await seedViaAdmin("tenants/tenant1/students/stu2", {
      ...studentDoc,
      id: "stu2",
    });
    const db = authedUser("parentUser", {
      tenantId: "tenant1",
      role: "parent",
      parentId: "par1",
      studentIds: ["stu1"],
    }).firestore();
    await assertFails(getDoc(doc(db, "tenants/tenant1/students", "stu2")));
  });

  it("superAdmin can CRUD students in any tenant", async () => {
    await seedViaAdmin("users/admin1", superAdminUserDoc);
    await seedViaAdmin("tenants/tenant1/students/stu1", studentDoc);
    const db = authedUser("admin1").firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/tenant1/students", "stu1")));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Conversation runtime — callable/Admin SDK authority records
// ══════════════════════════════════════════════════════════════════════════

describe("/tenants/{tenantId}/conversation runtime records", () => {
  const protectedPaths = [
    "tenants/tenant1/conversationSessions/session1",
    "tenants/tenant1/conversationSessions/session1/messages/message1",
    "tenants/tenant1/conversationSessions/session1/turns/turn1",
    "tenants/tenant1/conversationSessions/session1/privateEvidence/evidence1",
    "tenants/tenant1/conversationSessionKeys/key1",
    "tenants/tenant1/itemSubmissions/submission1",
    "tenants/tenant1/itemSubmissions/submission1/evaluationAttempts/attempt1",
    "tenants/tenant1/spaceProgress/studentUser1_space1/applications/submission1",
  ] as const;

  async function seedRuntimeRecords(): Promise<void> {
    for (const target of protectedPaths) {
      await seedViaAdmin(target, {
        id: target.split("/").at(-1),
        tenantId: "tenant1",
        ownerUid: "studentUser1",
      });
    }
    await seedViaAdmin("tenants/tenant1/spaceProgress/studentUser1_space1", {
      id: "studentUser1_space1",
      tenantId: "tenant1",
      userId: "studentUser1",
    });
  }

  const actors: Array<[string, () => RulesTestContext]> = [
    [
      "student owner",
      () =>
        authedUser("studentUser1", {
          tenantId: "tenant1",
          role: "student",
          studentId: "student1",
        }),
    ],
    [
      "teacher",
      () =>
        authedUser("teacherUser1", {
          tenantId: "tenant1",
          role: "teacher",
          teacherId: "teacher1",
        }),
    ],
    [
      "tenant admin",
      () =>
        authedUser("tenantAdmin1", {
          tenantId: "tenant1",
          role: "tenantAdmin",
        }),
    ],
    ["unauthenticated", () => unauthenticated()],
  ];

  for (const [actorName, context] of actors) {
    it(`${actorName} cannot directly read any conversation runtime authority document`, async () => {
      await seedRuntimeRecords();
      const firestore = context().firestore();
      for (const target of protectedPaths) {
        await assertFails(getDoc(doc(firestore, target)));
      }
    });
  }

  it("student owner cannot directly write a runtime session", async () => {
    const firestore = actors[0]![1]().firestore();
    await assertFails(
      setDoc(doc(firestore, "tenants/tenant1/conversationSessions/session1"), {
        tenantId: "tenant1",
        ownerUid: "studentUser1",
      })
    );
  });
});
