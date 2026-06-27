/**
 * autograde-seed.ts
 *
 * Idempotent Admin-SDK seed for the autograde Playwright scaffold.
 * Provisions one tenant + one teacher + one class + one student so the spec
 * does NOT depend on whatever ambient seed data happens to exist.
 *
 * Re-runs cleanly: if the tenant/teacher/class/student already exist with the
 * configured codes/emails, they are reused (no duplicates, no resets).
 *
 * Env vars (with defaults):
 *   FIRESTORE_EMULATOR_HOST       e.g. 'localhost:8080' (set ⇒ emulator mode)
 *   FIREBASE_AUTH_EMULATOR_HOST   e.g. 'localhost:9099'
 *   GOOGLE_CLOUD_PROJECT          GCP project id (defaults to 'lvlup-ff6fa')
 *   TENANT_CODE                   short code, default 'AGE2E1' (Autograde E2E 1)
 *   TEACHER_EMAIL                 default 'autograde-teacher@e2e.test'
 *   TEACHER_PASSWORD              default 'Test@12345'
 *   STUDENT_EMAIL                 default 'autograde-student@e2e.test'
 *
 * NOTE: This file requires `firebase-admin` (already declared at repo root,
 * package.json:dependencies."firebase-admin"). It is ONLY imported by Node-side
 * test setup, never bundled into the browser context.
 */

import admin from "firebase-admin";

export interface AutogradeSeed {
  tenantId: string;
  tenantCode: string;
  teacher: { uid: string; entityId: string; email: string; password: string };
  classId: string;
  className: string;
  student: { uid: string; entityId: string; email: string; rollNumber: string };
}

const DEFAULTS = {
  tenantCode: "AGE2E1",
  tenantName: "Autograde E2E Tenant",
  teacherEmail: "autograde-teacher@e2e.test",
  teacherPassword: "Test@12345",
  studentEmail: "autograde-student@e2e.test",
  studentRollNumber: "AGE2E-S001",
  className: "Autograde E2E Class",
  classSubject: "Science",
  classGrade: "10",
  projectId: "lvlup-ff6fa",
};

let initialized = false;
function getApp(): admin.app.App {
  if (!initialized) {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT ?? DEFAULTS.projectId,
      });
    }
    initialized = true;
  }
  return admin.app();
}

async function ensureAuthUser(
  auth: admin.auth.Auth,
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const u = await auth.createUser({ email, password, displayName });
    return u.uid;
  }
}

async function ensureTenant(
  db: admin.firestore.Firestore,
  tenantCode: string,
  tenantName: string
): Promise<string> {
  const codeDoc = await db.doc(`tenantCodes/${tenantCode}`).get();
  if (codeDoc.exists) {
    const tenantId = codeDoc.data()!["tenantId"] as string;
    return tenantId;
  }
  const tenantRef = db.collection("tenants").doc();
  const now = admin.firestore.Timestamp.now();
  await tenantRef.set({
    id: tenantRef.id,
    name: tenantName,
    slug: tenantCode.toLowerCase(),
    tenantCode,
    ownerUid: "autograde-seed",
    contactEmail: DEFAULTS.teacherEmail,
    status: "active",
    subscription: {
      plan: "premium",
      maxStudents: 50,
      maxTeachers: 10,
      maxSpaces: 10,
      maxExamsPerMonth: 50,
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
    settings: { geminiKeySet: false, timezone: "Asia/Kolkata", locale: "en-IN" },
    stats: { totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalSpaces: 0, totalExams: 0 },
    createdAt: now,
    updatedAt: now,
  });
  await db.doc(`tenantCodes/${tenantCode}`).set({ tenantId: tenantRef.id, createdAt: now });
  return tenantRef.id;
}

async function ensureClass(
  db: admin.firestore.Firestore,
  tenantId: string,
  classKey: string
): Promise<string> {
  // Deterministic doc id so re-runs are idempotent
  const classRef = db.doc(`tenants/${tenantId}/classes/${classKey}`);
  const snap = await classRef.get();
  if (snap.exists && snap.data()!["status"] === "active") {
    return classKey;
  }
  const now = admin.firestore.Timestamp.now();
  await classRef.set({
    id: classKey,
    tenantId,
    name: DEFAULTS.className,
    subject: DEFAULTS.classSubject,
    grade: DEFAULTS.classGrade,
    displayOrder: 1,
    teacherIds: [],
    studentCount: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return classKey;
}

async function ensureUserDoc(
  db: admin.firestore.Firestore,
  uid: string,
  email: string,
  firstName: string,
  lastName: string,
  isSuperAdmin = false
): Promise<void> {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists) return;
  const now = admin.firestore.Timestamp.now();
  await ref.set({
    uid,
    email,
    phone: null,
    authProviders: ["email"],
    displayName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    photoURL: null,
    isSuperAdmin,
    consumerProfile: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureTeacherEntity(
  db: admin.firestore.Firestore,
  tenantId: string,
  authUid: string,
  email: string,
  classIds: string[]
): Promise<string> {
  // Look up by authUid first to avoid duplicate teacher entities
  const existing = await db
    .collection(`tenants/${tenantId}/teachers`)
    .where("authUid", "==", authUid)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0]!.id;

  const ref = db.collection(`tenants/${tenantId}/teachers`).doc();
  const now = admin.firestore.Timestamp.now();
  await ref.set({
    id: ref.id,
    tenantId,
    authUid,
    email,
    firstName: "E2E",
    lastName: "Teacher",
    displayName: "E2E Teacher",
    employeeId: "AGE2E-T001",
    department: "Science",
    classIds,
    subjects: [DEFAULTS.classSubject],
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

async function ensureStudentEntity(
  db: admin.firestore.Firestore,
  tenantId: string,
  authUid: string,
  email: string,
  classIds: string[],
  rollNumber: string
): Promise<string> {
  const existing = await db
    .collection(`tenants/${tenantId}/students`)
    .where("authUid", "==", authUid)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0]!.id;

  const ref = db.collection(`tenants/${tenantId}/students`).doc();
  const now = admin.firestore.Timestamp.now();
  await ref.set({
    id: ref.id,
    tenantId,
    authUid,
    email,
    firstName: "E2E",
    lastName: "Student",
    displayName: "E2E Student",
    rollNumber,
    classIds,
    parentIds: [],
    status: "active",
    metadata: { admissionYear: "2025" },
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

async function ensureMembership(
  db: admin.firestore.Firestore,
  uid: string,
  tenantId: string,
  tenantCode: string,
  role: "teacher" | "student",
  entityId: string,
  classIds: string[]
): Promise<void> {
  const id = `${uid}_${tenantId}`;
  const now = admin.firestore.Timestamp.now();
  const payload: Record<string, unknown> = {
    id,
    uid,
    tenantId,
    tenantCode,
    role,
    status: "active",
    joinSource: "admin_created",
    permissions: {
      managedClassIds: classIds,
      ...(role === "teacher"
        ? {
            canCreateExams: true,
            canEditRubrics: true,
            canManuallyGrade: true,
            canViewAllExams: false,
            canCreateSpaces: true,
            canManageContent: true,
            canViewAnalytics: true,
            canConfigureAgents: false,
            managedSpaceIds: [],
          }
        : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
  if (role === "teacher") payload["teacherId"] = entityId;
  else payload["studentId"] = entityId;
  await db.doc(`userMemberships/${id}`).set(payload, { merge: true });
}

async function setRoleClaims(
  auth: admin.auth.Auth,
  uid: string,
  tenantId: string,
  tenantCode: string,
  role: "teacher" | "student",
  entityId: string,
  classIds: string[]
): Promise<void> {
  const claims: Record<string, unknown> = {
    role,
    tenantId,
    tenantCode,
    ...(role === "teacher"
      ? { teacherId: entityId, managedClassIds: classIds.slice(0, 15) }
      : { studentId: entityId, classIds: classIds.slice(0, 15) }),
  };
  await auth.setCustomUserClaims(uid, claims);
}

/**
 * Idempotently provisions tenant + teacher + class + student.
 * Safe to call from a Playwright `beforeAll` hook.
 */
export async function seedAutogradeTenant(overrides?: {
  tenantCode?: string;
  teacherEmail?: string;
  teacherPassword?: string;
  studentEmail?: string;
}): Promise<AutogradeSeed> {
  const tenantCode = overrides?.tenantCode ?? process.env["TENANT_CODE"] ?? DEFAULTS.tenantCode;
  const teacherEmail =
    overrides?.teacherEmail ?? process.env["TEACHER_EMAIL"] ?? DEFAULTS.teacherEmail;
  const teacherPassword =
    overrides?.teacherPassword ?? process.env["TEACHER_PASSWORD"] ?? DEFAULTS.teacherPassword;
  const studentEmail =
    overrides?.studentEmail ?? process.env["STUDENT_EMAIL"] ?? DEFAULTS.studentEmail;

  const app = getApp();
  const db = app.firestore();
  const auth = app.auth();

  const tenantId = await ensureTenant(db, tenantCode, DEFAULTS.tenantName);

  // Class id is deterministic on the tenantCode for idempotent re-runs
  const classKey = `cls_${tenantCode.toLowerCase()}_main`;
  const classId = await ensureClass(db, tenantId, classKey);

  // Teacher
  const teacherUid = await ensureAuthUser(auth, teacherEmail, teacherPassword, "E2E Teacher");
  await ensureUserDoc(db, teacherUid, teacherEmail, "E2E", "Teacher");
  const teacherEntityId = await ensureTeacherEntity(db, tenantId, teacherUid, teacherEmail, [
    classId,
  ]);
  await ensureMembership(db, teacherUid, tenantId, tenantCode, "teacher", teacherEntityId, [
    classId,
  ]);
  await setRoleClaims(auth, teacherUid, tenantId, tenantCode, "teacher", teacherEntityId, [
    classId,
  ]);

  // Student
  const studentUid = await ensureAuthUser(
    auth,
    studentEmail,
    DEFAULTS.teacherPassword,
    "E2E Student"
  );
  await ensureUserDoc(db, studentUid, studentEmail, "E2E", "Student");
  const studentEntityId = await ensureStudentEntity(
    db,
    tenantId,
    studentUid,
    studentEmail,
    [classId],
    DEFAULTS.studentRollNumber
  );
  await ensureMembership(db, studentUid, tenantId, tenantCode, "student", studentEntityId, [
    classId,
  ]);
  await setRoleClaims(auth, studentUid, tenantId, tenantCode, "student", studentEntityId, [
    classId,
  ]);

  // Wire class → teacher / studentCount
  await db.doc(`tenants/${tenantId}/classes/${classId}`).set(
    {
      teacherIds: admin.firestore.FieldValue.arrayUnion(teacherUid),
      studentCount: 1,
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );

  return {
    tenantId,
    tenantCode,
    teacher: {
      uid: teacherUid,
      entityId: teacherEntityId,
      email: teacherEmail,
      password: teacherPassword,
    },
    classId,
    className: DEFAULTS.className,
    student: {
      uid: studentUid,
      entityId: studentEntityId,
      email: studentEmail,
      rollNumber: DEFAULTS.studentRollNumber,
    },
  };
}
