/**
 * Tenant isolation tests — verify that tenantA users cannot access tenantB data.
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

function tenantAAdmin(): RulesTestContext {
  return testEnv.authenticatedContext("adminA", {
    tenantId: "tenantA",
    role: "tenantAdmin",
  });
}

function tenantBAdmin(): RulesTestContext {
  return testEnv.authenticatedContext("adminB", {
    tenantId: "tenantB",
    role: "tenantAdmin",
  });
}

function tenantATeacher(): RulesTestContext {
  return testEnv.authenticatedContext("teacherA", {
    tenantId: "tenantA",
    role: "teacher",
    classIds: ["classA1"],
  });
}

function tenantAStudent(): RulesTestContext {
  return testEnv.authenticatedContext("studentA", {
    tenantId: "tenantA",
    role: "student",
    studentId: "stuA1",
    classIds: ["classA1"],
  });
}

function tenantBStudent(): RulesTestContext {
  return testEnv.authenticatedContext("studentB", {
    tenantId: "tenantB",
    role: "student",
    studentId: "stuB1",
    classIds: ["classB1"],
  });
}

async function seed(docPath: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), docPath), data);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Tenant isolation: students collection", () => {
  it("tenantA admin cannot read tenantB students", async () => {
    await seed("tenants/tenantB/students/stuB1", {
      id: "stuB1",
      tenantId: "tenantB",
      authUid: "studentB",
      firstName: "Bob",
      status: "active",
    });

    const db = tenantAAdmin().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/students", "stuB1")));
  });

  it("tenantA student cannot read tenantB student doc", async () => {
    await seed("tenants/tenantB/students/stuB1", {
      id: "stuB1",
      tenantId: "tenantB",
      authUid: "studentB",
      firstName: "Bob",
      status: "active",
    });

    const db = tenantAStudent().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/students", "stuB1")));
  });
});

describe("Tenant isolation: classes collection", () => {
  it("tenantA admin cannot read tenantB classes", async () => {
    await seed("tenants/tenantB/classes/classB1", {
      id: "classB1",
      tenantId: "tenantB",
      name: "Class B1",
    });
    await seed("userMemberships/adminA_tenantB", {
      uid: "adminA",
      tenantId: "tenantB",
      status: "inactive",
      role: "tenantAdmin",
    });

    const db = tenantAAdmin().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/classes", "classB1")));
  });

  it("tenantA admin can read own tenant classes", async () => {
    await seed("tenants/tenantA/classes/classA1", {
      id: "classA1",
      tenantId: "tenantA",
      name: "Class A1",
    });
    await seed("userMemberships/adminA_tenantA", {
      uid: "adminA",
      tenantId: "tenantA",
      status: "active",
      role: "tenantAdmin",
    });

    const db = tenantAAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/tenantA/classes", "classA1")));
  });
});

describe("Tenant isolation: exams collection", () => {
  it("tenantA teacher cannot read tenantB exams", async () => {
    await seed("tenants/tenantB/exams/examB1", {
      id: "examB1",
      tenantId: "tenantB",
      createdBy: "teacherB",
      classIds: ["classB1"],
      status: "published",
    });

    const db = tenantATeacher().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/exams", "examB1")));
  });

  it("tenantA admin cannot write to tenantB exams", async () => {
    await seed("tenants/tenantB/exams/examB1", {
      id: "examB1",
      tenantId: "tenantB",
      createdBy: "teacherB",
      classIds: ["classB1"],
      status: "draft",
    });

    const db = tenantAAdmin().firestore();
    await assertFails(
      updateDoc(doc(db, "tenants/tenantB/exams", "examB1"), { status: "published" })
    );
  });
});

describe("Tenant isolation: submissions collection", () => {
  it("tenantA student cannot read tenantB submissions", async () => {
    await seed("tenants/tenantB/submissions/subB1", {
      id: "subB1",
      tenantId: "tenantB",
      studentId: "stuB1",
      classId: "classB1",
      examId: "examB1",
    });

    const db = tenantAStudent().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/submissions", "subB1")));
  });

  it("tenantB student cannot create submission in tenantA", async () => {
    const db = tenantBStudent().firestore();
    await assertFails(
      setDoc(doc(db, "tenants/tenantA/submissions", "subCross"), {
        studentId: "stuB1",
        classId: "classB1",
        examId: "examA1",
      })
    );
  });
});

describe("Tenant isolation: spaces collection", () => {
  it("tenantA teacher cannot read tenantB spaces", async () => {
    await seed("tenants/tenantB/spaces/spaceB1", {
      id: "spaceB1",
      tenantId: "tenantB",
      createdBy: "teacherB",
      accessType: "tenant_wide",
      classIds: [],
    });

    const db = tenantATeacher().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/spaces", "spaceB1")));
  });

  it("tenantA admin cannot delete tenantB spaces", async () => {
    await seed("tenants/tenantB/spaces/spaceB1", {
      id: "spaceB1",
      tenantId: "tenantB",
      createdBy: "teacherB",
      accessType: "tenant_wide",
    });

    const db = tenantAAdmin().firestore();
    await assertFails(deleteDoc(doc(db, "tenants/tenantB/spaces", "spaceB1")));
  });
});

describe("Tenant isolation: progress collections", () => {
  it("tenantA student cannot read tenantB spaceProgress", async () => {
    await seed("tenants/tenantB/spaceProgress/stuB1_spaceB1", {
      userId: "studentB",
      studentId: "stuB1",
      spaceId: "spaceB1",
      status: "in_progress",
    });

    const db = tenantAStudent().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/spaceProgress", "stuB1_spaceB1")));
  });

  it("tenantA student cannot write to tenantB progress", async () => {
    const db = tenantAStudent().firestore();
    await assertFails(
      setDoc(doc(db, "tenants/tenantB/progress", "stuA1_cross"), {
        studentId: "stuA1",
        status: "in_progress",
      })
    );
  });
});

describe("Tenant isolation: settings collections", () => {
  it("tenantA admin cannot read tenantB academic sessions", async () => {
    await seed("tenants/tenantB/academicSessions/session1", {
      id: "session1",
      tenantId: "tenantB",
      name: "2025-2026",
    });
    // No active membership for adminA in tenantB
    const db = tenantAAdmin().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/academicSessions", "session1")));
  });

  it("tenantA admin cannot read tenantB llmCallLogs", async () => {
    await seed("tenants/tenantB/llmCallLogs/log1", {
      id: "log1",
      tenantId: "tenantB",
      tokens: 100,
    });

    const db = tenantAAdmin().firestore();
    await assertFails(getDoc(doc(db, "tenants/tenantB/llmCallLogs", "log1")));
  });
});
