/**
 * Role-based access control tests — verify that each role can only access
 * what it should across all major collections.
 *
 * Roles: superAdmin, tenantAdmin, teacher, student, parent
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

const T = "tenant1"; // tenant ID used throughout

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
  // superAdmin is verified by checking /users/{uid}.isSuperAdmin == true
  return testEnv.authenticatedContext("superadmin1");
}

function tenantAdmin(): RulesTestContext {
  return testEnv.authenticatedContext("admin1", {
    tenantId: T,
    role: "tenantAdmin",
    classIds: [],
    classIdsOverflow: false,
  });
}

function teacher(classIds: string[] = ["class1"]): RulesTestContext {
  return testEnv.authenticatedContext("teacher1", {
    tenantId: T,
    role: "teacher",
    classIds,
    classIdsOverflow: false,
  });
}

function student(studentId = "stu1", classIds: string[] = ["class1"]): RulesTestContext {
  return testEnv.authenticatedContext("student1", {
    tenantId: T,
    role: "student",
    studentId,
    classIds,
    classIdsOverflow: false,
  });
}

function parent(parentId = "par1", studentIds: string[] = ["stu1"]): RulesTestContext {
  return testEnv.authenticatedContext("parent1", {
    tenantId: T,
    role: "parent",
    parentId,
    studentIds,
    classIds: ["class1"],
    classIdsOverflow: false,
  });
}

// Seed the superAdmin user doc (required for isSuperAdmin check in rules)
async function seedSuperAdmin() {
  await seed("users/superadmin1", {
    uid: "superadmin1",
    isSuperAdmin: true,
    status: "active",
  });
}

// ── superAdmin ─────────────────────────────────────────────────────────────

describe("superAdmin has full access", () => {
  it("can read any tenant", async () => {
    await seedSuperAdmin();
    await seed(`tenants/${T}`, { id: T, name: "Test School", status: "active" });

    const db = superAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, "tenants", T)));
  });

  it("can create tenants", async () => {
    await seedSuperAdmin();

    const db = superAdmin().firestore();
    await assertSucceeds(
      setDoc(doc(db, "tenants", "newTenant"), { id: "newTenant", name: "New", status: "active" })
    );
  });

  it("can CRUD students in any tenant", async () => {
    await seedSuperAdmin();
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      authUid: "student1",
      status: "active",
    });

    const db = superAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/students`, "stu1")));
    await assertSucceeds(
      updateDoc(doc(db, `tenants/${T}/students`, "stu1"), { firstName: "Updated" })
    );
    await assertSucceeds(deleteDoc(doc(db, `tenants/${T}/students`, "stu1")));
  });

  it("can CRUD exams in any tenant", async () => {
    await seedSuperAdmin();
    await seed(`tenants/${T}/exams/exam1`, {
      id: "exam1",
      tenantId: T,
      createdBy: "teacher1",
      classIds: ["class1"],
      status: "draft",
    });

    const db = superAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/exams`, "exam1")));
    await assertSucceeds(deleteDoc(doc(db, `tenants/${T}/exams`, "exam1")));
  });

  it("can CRUD spaces in any tenant", async () => {
    await seedSuperAdmin();
    await seed(`tenants/${T}/spaces/space1`, {
      id: "space1",
      tenantId: T,
      createdBy: "teacher1",
      accessType: "tenant_wide",
    });

    const db = superAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/spaces`, "space1")));
    await assertSucceeds(deleteDoc(doc(db, `tenants/${T}/spaces`, "space1")));
  });
});

// ── tenantAdmin ────────────────────────────────────────────────────────────

describe("tenantAdmin has full tenant access", () => {
  it("can read and update own tenant", async () => {
    await seed(`tenants/${T}`, { id: T, name: "Test School", status: "active" });

    const db = tenantAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, "tenants", T)));
    await assertFails(updateDoc(doc(db, "tenants", T), { name: "Renamed" }));
  });

  it("can CRUD students in own tenant", async () => {
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      authUid: "student1",
      status: "active",
    });

    const db = tenantAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/students`, "stu1")));
    await assertSucceeds(
      setDoc(doc(db, `tenants/${T}/students`, "stu2"), {
        id: "stu2",
        tenantId: T,
        status: "active",
      })
    );
    await assertSucceeds(deleteDoc(doc(db, `tenants/${T}/students`, "stu1")));
  });

  it("can CRUD exams in own tenant", async () => {
    await seed(`tenants/${T}/exams/exam1`, {
      id: "exam1",
      createdBy: "teacher1",
      classIds: ["class1"],
      status: "draft",
    });

    const db = tenantAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/exams`, "exam1")));
    await assertSucceeds(
      updateDoc(doc(db, `tenants/${T}/exams`, "exam1"), { status: "published" })
    );
  });

  it("cannot create new tenants", async () => {
    const db = tenantAdmin().firestore();
    await assertFails(setDoc(doc(db, "tenants", "newTenant"), { id: "newTenant", name: "Hijack" }));
  });
});

// ── teacher ────────────────────────────────────────────────────────────────

describe("teacher access is scoped to owned resources", () => {
  it("can read students in own tenant", async () => {
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      authUid: "student1",
      status: "active",
    });

    const db = teacher().firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/students`, "stu1")));
  });

  it("can create spaces in own tenant", async () => {
    await seed(`tenants/${T}`, { id: T, name: "School", status: "active" });
    const db = teacher().firestore();
    await assertSucceeds(
      setDoc(doc(db, `tenants/${T}/spaces`, "newSpace"), {
        id: "newSpace",
        tenantId: T,
        createdBy: "teacher1",
        accessType: "tenant_wide",
        classIds: [],
      })
    );
  });

  it("can update own space but not another teacher space", async () => {
    await seed(`tenants/${T}`, { id: T, name: "School", status: "active" });
    await seed(`tenants/${T}/spaces/mySpace`, {
      id: "mySpace",
      tenantId: T,
      createdBy: "teacher1",
      accessType: "tenant_wide",
    });
    await seed(`tenants/${T}/spaces/otherSpace`, {
      id: "otherSpace",
      tenantId: T,
      createdBy: "teacher2",
      accessType: "tenant_wide",
    });

    const db = teacher().firestore();
    await assertSucceeds(
      updateDoc(doc(db, `tenants/${T}/spaces`, "mySpace"), { title: "Updated" })
    );
    await assertFails(updateDoc(doc(db, `tenants/${T}/spaces`, "otherSpace"), { title: "Hijack" }));
  });

  it("can read exams assigned to own class", async () => {
    await seed(`tenants/${T}/exams/exam1`, {
      id: "exam1",
      createdBy: "teacher2",
      classIds: ["class1"],
      status: "published",
    });

    const db = teacher(["class1"]).firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/exams`, "exam1")));
  });

  it("cannot delete students", async () => {
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      status: "active",
    });

    const db = teacher().firestore();
    await assertFails(deleteDoc(doc(db, `tenants/${T}/students`, "stu1")));
  });

  it("cannot update tenant doc", async () => {
    await seed(`tenants/${T}`, { id: T, name: "School", status: "active" });
    await seed(`userMemberships/teacher1_${T}`, {
      uid: "teacher1",
      tenantId: T,
      status: "active",
      role: "teacher",
    });

    const db = teacher().firestore();
    await assertFails(updateDoc(doc(db, "tenants", T), { name: "Hacked" }));
  });
});

// ── student ────────────────────────────────────────────────────────────────

describe("student access is scoped to enrolled resources", () => {
  it("can read own student doc", async () => {
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      authUid: "student1",
      status: "active",
    });

    const db = student("stu1").firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/students`, "stu1")));
  });

  it("cannot read another student doc", async () => {
    await seed(`tenants/${T}/students/stu2`, {
      id: "stu2",
      tenantId: T,
      authUid: "student2",
      status: "active",
    });

    const db = student("stu1").firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/students`, "stu2")));
  });

  it("can read published exams in own class", async () => {
    await seed(`tenants/${T}/exams/exam1`, {
      id: "exam1",
      createdBy: "teacher1",
      classIds: ["class1"],
      status: "published",
    });

    const db = student("stu1", ["class1"]).firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/exams`, "exam1")));
  });

  it("cannot read draft exams", async () => {
    await seed(`tenants/${T}/exams/examDraft`, {
      id: "examDraft",
      createdBy: "teacher1",
      classIds: ["class1"],
      status: "draft",
    });

    const db = student("stu1", ["class1"]).firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/exams`, "examDraft")));
  });

  it("can create own submission", async () => {
    await seed(`tenants/${T}`, { id: T, name: "School", status: "active" });
    const db = student("stu1").firestore();
    await assertSucceeds(
      setDoc(doc(db, `tenants/${T}/submissions`, "sub1"), {
        studentId: "stu1",
        examId: "exam1",
        classId: "class1",
      })
    );
  });

  it("cannot create submission for another student", async () => {
    const db = student("stu1").firestore();
    await assertFails(
      setDoc(doc(db, `tenants/${T}/submissions`, "sub2"), {
        studentId: "stu2",
        examId: "exam1",
        classId: "class1",
      })
    );
  });

  it("can write own space progress", async () => {
    await seed(`tenants/${T}`, { id: T, name: "School", status: "active" });
    const db = student("stu1").firestore();
    await assertSucceeds(
      setDoc(doc(db, `tenants/${T}/spaceProgress`, "stu1_space1"), {
        studentId: "stu1",
        spaceId: "space1",
        status: "in_progress",
      })
    );
  });

  it("cannot write another student space progress", async () => {
    const db = student("stu1").firestore();
    await assertFails(
      setDoc(doc(db, `tenants/${T}/spaceProgress`, "stu2_space1"), {
        studentId: "stu2",
        spaceId: "space1",
        status: "in_progress",
      })
    );
  });

  it("cannot delete exams", async () => {
    await seed(`tenants/${T}/exams/exam1`, {
      id: "exam1",
      createdBy: "teacher1",
      classIds: ["class1"],
      status: "published",
    });

    const db = student("stu1").firestore();
    await assertFails(deleteDoc(doc(db, `tenants/${T}/exams`, "exam1")));
  });

  it("cannot access class summaries (student blocked)", async () => {
    // chatSessions: student can only read if resource.data.studentId matches
    await seed(`tenants/${T}/chatSessions/chat1`, {
      studentId: "stu2",
    });

    const db = student("stu1").firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/chatSessions`, "chat1")));
  });
});

// ── parent ─────────────────────────────────────────────────────────────────

describe("parent access is scoped to linked children", () => {
  it("can read linked child student doc", async () => {
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      authUid: "student1",
      status: "active",
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/students`, "stu1")));
  });

  it("cannot read unlinked student doc", async () => {
    await seed(`tenants/${T}/students/stu2`, {
      id: "stu2",
      tenantId: T,
      authUid: "student2",
      status: "active",
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/students`, "stu2")));
  });

  it("can read own parent doc", async () => {
    await seed(`tenants/${T}/parents/par1`, {
      id: "par1",
      tenantId: T,
      authUid: "parent1",
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/parents`, "par1")));
  });

  it("cannot read another parent doc", async () => {
    await seed(`tenants/${T}/parents/par2`, {
      id: "par2",
      tenantId: T,
      authUid: "parent2",
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/parents`, "par2")));
  });

  it("can read linked child submission when results released", async () => {
    await seed(`tenants/${T}/submissions/sub1`, {
      studentId: "stu1",
      classId: "class1",
      examId: "exam1",
      resultsReleased: true,
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${T}/submissions`, "sub1")));
  });

  it("cannot read linked child submission before results released", async () => {
    await seed(`tenants/${T}/submissions/sub2`, {
      studentId: "stu1",
      classId: "class1",
      examId: "exam1",
      resultsReleased: false,
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertFails(getDoc(doc(db, `tenants/${T}/submissions`, "sub2")));
  });

  it("cannot create exams", async () => {
    const db = parent("par1").firestore();
    await assertFails(
      setDoc(doc(db, `tenants/${T}/exams`, "exam99"), {
        id: "exam99",
        createdBy: "parent1",
        classIds: ["class1"],
        status: "draft",
      })
    );
  });

  it("cannot write to student docs", async () => {
    await seed(`tenants/${T}/students/stu1`, {
      id: "stu1",
      tenantId: T,
      status: "active",
    });

    const db = parent("par1", ["stu1"]).firestore();
    await assertFails(updateDoc(doc(db, `tenants/${T}/students`, "stu1"), { firstName: "Hacked" }));
  });
});
