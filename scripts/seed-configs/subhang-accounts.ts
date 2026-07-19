/**
 * Subhang Academy — Tenant & Account Seed Configuration
 *
 * Creates:
 *   - 1 Tenant (Subhang Academy, code: SUB001, premium plan)
 *   - 1 Academic Session (2025-26, current)
 *   - 4 Classes (System Design, DSA, LLD, Behavioral)
 *   - 1 Admin/Teacher (shared UID: subhang.rocklee@gmail.com)
 *   - 1 Student (student.test@subhang.academy)
 *   - 1 Parent (parent.test@subhang.academy → linked to student)
 *
 * Usage: imported by the seed runner — does NOT initialize Firebase itself.
 */

import type admin from "firebase-admin";

// ─── Data Constants ──────────────────────────────────────────────────────────

export const TENANT_CODE = "SUB001";
export const SCHOOL_NAME = "Subhang Academy";
export const DEFAULT_PASSWORD = "Test@12345";

export const ADMIN_TEACHER = {
  email: "subhang.rocklee@gmail.com",
  password: DEFAULT_PASSWORD,
  displayName: "Subhang",
  firstName: "Subhang",
  lastName: "",
  department: "Computer Science",
  subjects: [
    "System Design",
    "Software Architecture",
    "DSA",
    "Low-Level Design",
    "Behavioral Interviews",
  ],
  employeeId: "SUB-T001",
};

export const STUDENT = {
  email: "student.test@subhang.academy",
  password: DEFAULT_PASSWORD,
  displayName: "Test Student",
  firstName: "Test",
  lastName: "Student",
  rollNumber: "2026001",
  grade: "10",
  section: "A",
};

export const PARENT = {
  email: "parent.test@subhang.academy",
  password: DEFAULT_PASSWORD,
  displayName: "Test Parent",
  firstName: "Test",
  lastName: "Parent",
  relationship: "parent" as const,
};

export const CLASS_DEF = {
  id: "cls_g10_sysdesign_a",
  name: "System Design Class",
  subject: "System Design",
  grade: "10",
  section: "A",
  displayOrder: 1,
};

export const ADDITIONAL_CLASSES = [
  {
    id: "cls_g10_dsa_a",
    name: "DSA Class",
    subject: "Data Structures & Algorithms",
    grade: "10",
    section: "A",
    displayOrder: 2,
  },
  {
    id: "cls_g10_lld_a",
    name: "LLD Class",
    subject: "Low-Level Design & OOP",
    grade: "10",
    section: "A",
    displayOrder: 3,
  },
  {
    id: "cls_g10_behavioral_a",
    name: "Behavioral Interview Class",
    subject: "Behavioral Interviews",
    grade: "10",
    section: "A",
    displayOrder: 4,
  },
];

export const ALL_CLASSES = [CLASS_DEF, ...ADDITIONAL_CLASSES];

// ─── Helpers (mirrored from seed-production.ts) ──────────────────────────────

const MAX_CLAIM_CLASS_IDS = 15;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface MembershipLike {
  role: string;
  tenantId: string;
  tenantCode: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  permissions?: { managedClassIds?: string[] };
  parentLinkedStudentIds?: string[];
}

function buildClaimsForMembership(m: MembershipLike): Record<string, unknown> {
  const classIds = m.permissions?.managedClassIds ?? [];
  const claims: Record<string, unknown> = {
    role: m.role,
    tenantId: m.tenantId,
    tenantCode: m.tenantCode,
  };
  switch (m.role) {
    case "teacher":
      claims.teacherId = m.teacherId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "student":
      claims.studentId = m.studentId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "parent":
      claims.parentId = m.parentId;
      claims.studentIds = m.parentLinkedStudentIds ?? [];
      break;
    case "tenantAdmin":
      break;
  }
  return claims;
}

// ─── Result Type ─────────────────────────────────────────────────────────────

export interface SeedAccountsResult {
  tenantId: string;
  classId: string;
  classIds: string[];
  teacherId: string;
  teacherEntityId: string;
  studentId: string;
  studentEntityId: string;
  parentId: string;
  parentEntityId: string;
  adminUid: string;
  studentUid: string;
  parentUid: string;
  academicSessionId: string;
}

// ─── Main Seed Function ──────────────────────────────────────────────────────

export async function seedAccounts(
  db: FirebaseFirestore.Firestore,
  auth: admin.auth.Auth,
  FieldValue: typeof admin.firestore.FieldValue,
  Timestamp: typeof admin.firestore.Timestamp
): Promise<SeedAccountsResult> {
  const now = Date.now();

  function ts(daysAgo = 0): admin.firestore.Timestamp {
    return Timestamp.fromMillis(now - daysAgo * 86400000);
  }

  async function ensureAuthUser(
    email: string,
    password: string,
    displayName: string
  ): Promise<string> {
    try {
      const existing = await auth.getUserByEmail(email);
      console.log(`    Auth user exists: ${email} (${existing.uid})`);
      return existing.uid;
    } catch {
      const userRecord = await auth.createUser({ email, password, displayName });
      console.log(`    Auth user created: ${email} (${userRecord.uid})`);
      return userRecord.uid;
    }
  }

  class BatchWriter {
    private batch = db.batch();
    private count = 0;
    private totalWrites = 0;

    async set(
      ref: FirebaseFirestore.DocumentReference,
      data: Record<string, unknown>
    ): Promise<void> {
      this.batch.set(ref, data);
      this.count++;
      this.totalWrites++;
      if (this.count >= 490) {
        await this.flush();
      }
    }

    async flush(): Promise<void> {
      if (this.count > 0) {
        await this.batch.commit();
        console.log(`    Batch committed (${this.count} writes, total: ${this.totalWrites})`);
        this.batch = db.batch();
        this.count = 0;
      }
    }
  }

  const bw = new BatchWriter();

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Subhang Academy — Tenant & Account Seed                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // =========================================================================
  // STEP 1: Tenant
  // =========================================================================
  console.log("[1/7] Creating tenant: Subhang Academy...");
  const tenantId = "tenant_subhang";
  const tenantRef = db.collection("tenants").doc(tenantId);

  await tenantRef.set({
    id: tenantId,
    name: SCHOOL_NAME,
    shortName: "Subhang",
    slug: generateSlug(SCHOOL_NAME),
    description: "Personal academy for system design and software architecture education.",
    tenantCode: TENANT_CODE,
    ownerUid: "placeholder",
    contactEmail: ADMIN_TEACHER.email,
    contactPhone: null,
    contactPerson: ADMIN_TEACHER.displayName,
    logoUrl: null,
    bannerUrl: null,
    website: null,
    address: {
      street: "",
      city: "",
      state: "",
      country: "India",
      zipCode: "",
    },
    status: "active",
    subscription: {
      plan: "premium",
      expiresAt: Timestamp.fromDate(new Date("2027-03-31")),
      maxStudents: 500,
      maxTeachers: 50,
      maxSpaces: 50,
      maxExamsPerMonth: 100,
    },
    features: {
      autoGradeEnabled: true,
      levelUpEnabled: true,
      scannerAppEnabled: true,
      aiChatEnabled: true,
      aiGradingEnabled: true,
      analyticsEnabled: true,
      parentPortalEnabled: true,
      bulkImportEnabled: true,
      apiAccessEnabled: true,
    },
    settings: {
      geminiKeySet: false,
      timezone: "Asia/Kolkata",
      locale: "en-IN",
    },
    stats: {
      totalStudents: 1,
      totalTeachers: 1,
      totalClasses: 4,
      totalSpaces: 0,
      totalExams: 0,
    },
    createdAt: ts(60),
    updatedAt: ts(0),
  });

  // Tenant code index
  await db.doc(`tenantCodes/${TENANT_CODE}`).set({
    tenantId,
    createdAt: ts(60),
  });
  console.log(`  Tenant created: ${SCHOOL_NAME} (${tenantId})\n`);

  // =========================================================================
  // STEP 2: Academic Session
  // =========================================================================
  console.log("[2/7] Creating academic session 2025-26...");
  const sessionRef = db.collection(`tenants/${tenantId}/academicSessions`).doc();
  const academicSessionId = sessionRef.id;

  await sessionRef.set({
    id: academicSessionId,
    tenantId,
    name: "2025-26",
    type: "annual",
    startDate: Timestamp.fromDate(new Date("2025-04-01")),
    endDate: Timestamp.fromDate(new Date("2026-03-31")),
    isCurrent: true,
    status: "active",
    createdBy: "seed-script",
    createdAt: ts(60),
    updatedAt: ts(0),
  });
  console.log(`  Session: 2025-26 (${academicSessionId})\n`);

  // =========================================================================
  // STEP 3: Classes (System Design + DSA + LLD + Behavioral)
  // =========================================================================
  console.log("[3/7] Creating classes...");
  const classId = CLASS_DEF.id; // primary class for backwards compat
  const allClassIds = ALL_CLASSES.map((c) => c.id);

  for (const cls of ALL_CLASSES) {
    await db.doc(`tenants/${tenantId}/classes/${cls.id}`).set({
      id: cls.id,
      tenantId,
      name: cls.name,
      subject: cls.subject,
      grade: cls.grade,
      section: cls.section,
      displayOrder: cls.displayOrder,
      academicSessionId,
      teacherIds: [],
      studentCount: 0,
      status: "active",
      createdBy: "seed-script",
      createdAt: ts(55),
      updatedAt: ts(0),
    });
    console.log(`  Class: ${cls.name} (${cls.id})`);
  }
  console.log("");

  // =========================================================================
  // STEP 4: Admin/Teacher (shared UID — tenantAdmin + teacher entity)
  // =========================================================================
  console.log("[4/7] Creating Admin/Teacher: subhang.rocklee@gmail.com...");
  const adminUid = await ensureAuthUser(
    ADMIN_TEACHER.email,
    ADMIN_TEACHER.password,
    ADMIN_TEACHER.displayName
  );

  // /users/{uid}
  await db.doc(`users/${adminUid}`).set({
    uid: adminUid,
    email: ADMIN_TEACHER.email,
    phone: null,
    authProviders: ["email"],
    displayName: ADMIN_TEACHER.displayName,
    firstName: ADMIN_TEACHER.firstName,
    lastName: ADMIN_TEACHER.lastName,
    photoURL: null,
    isSuperAdmin: false,
    consumerProfile: null,
    status: "active",
    createdAt: ts(55),
    updatedAt: ts(0),
  });

  // Teacher entity under tenant
  const teacherEntityRef = db.collection(`tenants/${tenantId}/teachers`).doc();
  const teacherEntityId = teacherEntityRef.id;

  await teacherEntityRef.set({
    id: teacherEntityId,
    tenantId,
    authUid: adminUid,
    email: ADMIN_TEACHER.email,
    firstName: ADMIN_TEACHER.firstName,
    lastName: ADMIN_TEACHER.lastName,
    displayName: ADMIN_TEACHER.displayName,
    employeeId: ADMIN_TEACHER.employeeId,
    department: ADMIN_TEACHER.department,
    classIds: allClassIds,
    subjects: ADMIN_TEACHER.subjects,
    status: "active",
    createdAt: ts(55),
    updatedAt: ts(0),
  });

  // Membership (tenantAdmin role — subsumes teacher)
  const adminMembershipId = `${adminUid}_${tenantId}`;
  await db.doc(`userMemberships/${adminMembershipId}`).set({
    id: adminMembershipId,
    uid: adminUid,
    tenantId,
    tenantCode: TENANT_CODE,
    role: "tenantAdmin",
    status: "active",
    joinSource: "admin_created",
    teacherId: teacherEntityId,
    permissions: null,
    createdAt: ts(55),
    updatedAt: ts(0),
  });

  // Custom claims: tenantAdmin
  await auth.setCustomUserClaims(
    adminUid,
    buildClaimsForMembership({
      role: "tenantAdmin",
      tenantId,
      tenantCode: TENANT_CODE,
    })
  );

  // Update tenant ownerUid
  await tenantRef.update({ ownerUid: adminUid });

  // Add teacher to all classes
  for (const cid of allClassIds) {
    await db.doc(`tenants/${tenantId}/classes/${cid}`).update({
      teacherIds: FieldValue.arrayUnion(adminUid),
    });
  }
  console.log(`  Admin/Teacher: ${ADMIN_TEACHER.email} (${adminUid})\n`);

  // =========================================================================
  // STEP 5: Student
  // =========================================================================
  console.log("[5/7] Creating Student: student.test@subhang.academy...");
  const studentUid = await ensureAuthUser(STUDENT.email, STUDENT.password, STUDENT.displayName);

  // /users/{uid}
  await db.doc(`users/${studentUid}`).set({
    uid: studentUid,
    email: STUDENT.email,
    phone: null,
    authProviders: ["email"],
    displayName: STUDENT.displayName,
    firstName: STUDENT.firstName,
    lastName: STUDENT.lastName,
    photoURL: null,
    isSuperAdmin: false,
    consumerProfile: null,
    grade: STUDENT.grade,
    status: "active",
    createdAt: ts(45),
    updatedAt: ts(0),
  });

  // Student entity under tenant
  const studentEntityRef = db.collection(`tenants/${tenantId}/students`).doc();
  const studentEntityId = studentEntityRef.id;

  await studentEntityRef.set({
    id: studentEntityId,
    tenantId,
    authUid: studentUid,
    email: STUDENT.email,
    firstName: STUDENT.firstName,
    lastName: STUDENT.lastName,
    displayName: STUDENT.displayName,
    rollNumber: STUDENT.rollNumber,
    classIds: allClassIds,
    parentIds: [],
    status: "active",
    metadata: { admissionYear: "2025" },
    createdAt: ts(45),
    updatedAt: ts(0),
  });

  // Membership
  const studentMembershipId = `${studentUid}_${tenantId}`;
  await db.doc(`userMemberships/${studentMembershipId}`).set({
    id: studentMembershipId,
    uid: studentUid,
    tenantId,
    tenantCode: TENANT_CODE,
    role: "student",
    status: "active",
    joinSource: "admin_created",
    studentId: studentEntityId,
    permissions: { managedClassIds: allClassIds },
    createdAt: ts(45),
    updatedAt: ts(0),
  });

  // Custom claims: student
  await auth.setCustomUserClaims(
    studentUid,
    buildClaimsForMembership({
      role: "student",
      tenantId,
      tenantCode: TENANT_CODE,
      studentId: studentEntityId,
      permissions: { managedClassIds: allClassIds },
    })
  );

  // Update class student counts
  for (const cid of allClassIds) {
    await db.doc(`tenants/${tenantId}/classes/${cid}`).update({
      studentCount: FieldValue.increment(1),
    });
  }
  console.log(`  Student: ${STUDENT.email} (${studentUid})\n`);

  // =========================================================================
  // STEP 6: Parent (linked to student)
  // =========================================================================
  console.log("[6/7] Creating Parent: parent.test@subhang.academy...");
  const parentUid = await ensureAuthUser(PARENT.email, PARENT.password, PARENT.displayName);

  // /users/{uid}
  await db.doc(`users/${parentUid}`).set({
    uid: parentUid,
    email: PARENT.email,
    phone: null,
    authProviders: ["email"],
    displayName: PARENT.displayName,
    firstName: PARENT.firstName,
    lastName: PARENT.lastName,
    photoURL: null,
    isSuperAdmin: false,
    consumerProfile: null,
    status: "active",
    createdAt: ts(40),
    updatedAt: ts(0),
  });

  // Parent entity under tenant
  const parentEntityRef = db.collection(`tenants/${tenantId}/parents`).doc();
  const parentEntityId = parentEntityRef.id;

  await parentEntityRef.set({
    id: parentEntityId,
    tenantId,
    authUid: parentUid,
    email: PARENT.email,
    firstName: PARENT.firstName,
    lastName: PARENT.lastName,
    displayName: PARENT.displayName,
    linkedStudentIds: [studentEntityId],
    relationship: PARENT.relationship,
    notificationPreferences: {
      emailNotifications: true,
      resultReleaseAlerts: true,
      weeklyProgressDigest: true,
      atRiskAlerts: true,
    },
    status: "active",
    createdAt: ts(40),
    updatedAt: ts(0),
  });

  // Membership
  const parentMembershipId = `${parentUid}_${tenantId}`;
  await db.doc(`userMemberships/${parentMembershipId}`).set({
    id: parentMembershipId,
    uid: parentUid,
    tenantId,
    tenantCode: TENANT_CODE,
    role: "parent",
    status: "active",
    joinSource: "admin_created",
    parentId: parentEntityId,
    parentLinkedStudentIds: [studentUid],
    createdAt: ts(40),
    updatedAt: ts(0),
  });

  // Custom claims: parent
  await auth.setCustomUserClaims(
    parentUid,
    buildClaimsForMembership({
      role: "parent",
      tenantId,
      tenantCode: TENANT_CODE,
      parentId: parentEntityId,
      parentLinkedStudentIds: [studentUid],
    })
  );
  console.log(`  Parent: ${PARENT.email} (${parentUid})\n`);

  // =========================================================================
  // STEP 7: Bidirectional references
  // =========================================================================
  console.log("[7/7] Updating bidirectional references...");

  // Link parent → student (update student's parentIds)
  await db.doc(`tenants/${tenantId}/students/${studentEntityId}`).update({
    parentIds: FieldValue.arrayUnion(parentEntityId),
  });

  // Update academic session createdBy to actual admin UID
  await sessionRef.update({ createdBy: adminUid });

  // Update all classes createdBy
  for (const cid of allClassIds) {
    await db.doc(`tenants/${tenantId}/classes/${cid}`).update({
      createdBy: adminUid,
    });
  }

  await bw.flush();
  console.log("  Bidirectional references updated.\n");

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Subhang Academy seed complete!                             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`  Tenant ID:          ${tenantId}`);
  console.log(`  Academic Session:   ${academicSessionId}`);
  console.log(`  Class IDs:          ${allClassIds.join(", ")}`);
  console.log(`  Admin/Teacher UID:  ${adminUid}`);
  console.log(`  Teacher Entity ID:  ${teacherEntityId}`);
  console.log(`  Student UID:        ${studentUid}`);
  console.log(`  Student Entity ID:  ${studentEntityId}`);
  console.log(`  Parent UID:         ${parentUid}`);
  console.log(`  Parent Entity ID:   ${parentEntityId}\n`);

  return {
    tenantId,
    classId,
    classIds: allClassIds,
    teacherId: adminUid,
    teacherEntityId,
    studentId: studentEntityId,
    studentEntityId,
    parentId: parentEntityId,
    parentEntityId,
    adminUid,
    studentUid,
    parentUid,
    academicSessionId,
  };
}
