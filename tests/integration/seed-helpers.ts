/**
 * Seed helpers for integration tests.
 * Uses the Admin SDK to create test data directly in emulators.
 */
import * as admin from "firebase-admin";
import { getAdminAuth, getAdminFirestore } from "./setup";

const db = () => getAdminFirestore();
const auth = () => getAdminAuth();

// ---------------------------------------------------------------------------
// Tenant helpers
// ---------------------------------------------------------------------------

export interface SeedTenantOptions {
  tenantId?: string;
  name: string;
  tenantCode: string;
  ownerUid: string;
  status?: "active" | "suspended" | "trial" | "expired";
}

export async function seedTenant(opts: SeedTenantOptions) {
  const ref = opts.tenantId
    ? db().doc(`tenants/${opts.tenantId}`)
    : db().collection("tenants").doc();
  const tenantId = ref.id;

  const tenantDoc = {
    id: tenantId,
    name: opts.name,
    slug: opts.name.toLowerCase().replace(/\s+/g, "-"),
    tenantCode: opts.tenantCode.toUpperCase(),
    ownerUid: opts.ownerUid,
    contactEmail: "admin@test.com",
    status: opts.status ?? "active",
    subscription: { plan: "trial" },
    features: {
      autoGradeEnabled: true,
      levelUpEnabled: true,
      scannerAppEnabled: false,
      aiChatEnabled: false,
      aiGradingEnabled: false,
      analyticsEnabled: true,
      parentPortalEnabled: false,
      bulkImportEnabled: true,
      apiAccessEnabled: false,
    },
    settings: { geminiKeySet: false },
    stats: {
      totalStudents: 0,
      totalTeachers: 0,
      totalClasses: 0,
      totalSpaces: 0,
      totalExams: 0,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await ref.set(tenantDoc);

  // Create tenant code index
  await db().doc(`tenantCodes/${opts.tenantCode.toUpperCase()}`).set({
    tenantId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { tenantId, tenantCode: opts.tenantCode.toUpperCase() };
}

// ---------------------------------------------------------------------------
// User + membership helpers
// ---------------------------------------------------------------------------

export interface SeedUserOptions {
  email: string;
  password: string;
  displayName: string;
  isSuperAdmin?: boolean;
}

export async function seedUser(opts: SeedUserOptions) {
  const userRecord = await auth().createUser({
    email: opts.email,
    password: opts.password,
    displayName: opts.displayName,
  });

  // Create /users/{uid} doc
  await db()
    .doc(`users/${userRecord.uid}`)
    .set({
      uid: userRecord.uid,
      email: opts.email,
      displayName: opts.displayName,
      authProviders: ["email"],
      isSuperAdmin: opts.isSuperAdmin ?? false,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  if (opts.isSuperAdmin) {
    await auth().setCustomUserClaims(userRecord.uid, {
      role: "superAdmin",
    });
  }

  return userRecord;
}

export interface SeedMembershipOptions {
  uid: string;
  tenantId: string;
  tenantCode: string;
  role: "tenantAdmin" | "teacher" | "student" | "parent" | "scanner";
  status?: "active" | "inactive" | "suspended";
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  classIds?: string[];
  parentLinkedStudentIds?: string[];
}

export async function seedMembership(opts: SeedMembershipOptions) {
  const membershipId = `${opts.uid}_${opts.tenantId}`;
  const permissions =
    opts.role === "teacher"
      ? {
          canCreateExams: true,
          canEditRubrics: true,
          canManuallyGrade: true,
          canViewAllExams: false,
          canCreateSpaces: false,
          canManageContent: false,
          canViewAnalytics: false,
          canConfigureAgents: false,
          managedSpaceIds: [],
          managedClassIds: opts.classIds ?? [],
        }
      : opts.role === "student"
        ? { managedClassIds: opts.classIds ?? [] }
        : undefined;

  const membershipDoc: Record<string, unknown> = {
    id: membershipId,
    uid: opts.uid,
    tenantId: opts.tenantId,
    tenantCode: opts.tenantCode,
    role: opts.role,
    status: opts.status ?? "active",
    joinSource: "admin_created",
    ...(permissions !== undefined ? { permissions } : {}),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (opts.teacherId) membershipDoc["teacherId"] = opts.teacherId;
  if (opts.studentId) membershipDoc["studentId"] = opts.studentId;
  if (opts.parentId) membershipDoc["parentId"] = opts.parentId;
  if (opts.scannerId) membershipDoc["scannerId"] = opts.scannerId;
  if (opts.parentLinkedStudentIds) {
    membershipDoc["parentLinkedStudentIds"] = opts.parentLinkedStudentIds;
  }

  await db().doc(`userMemberships/${membershipId}`).set(membershipDoc);

  return { membershipId };
}

/**
 * Set custom claims on a user to simulate the state after
 * switchActiveTenant has been called.
 */
export async function setUserClaims(uid: string, claims: Record<string, unknown>) {
  await auth().setCustomUserClaims(uid, claims);
}

// ---------------------------------------------------------------------------
// Entity helpers (teacher / student docs under tenant)
// ---------------------------------------------------------------------------

export async function seedTeacherEntity(
  tenantId: string,
  uid: string,
  opts: { firstName: string; lastName: string; subjects?: string[] }
) {
  const ref = db().collection(`tenants/${tenantId}/teachers`).doc();
  await ref.set({
    id: ref.id,
    tenantId,
    authUid: uid,
    firstName: opts.firstName,
    lastName: opts.lastName,
    displayName: `${opts.firstName} ${opts.lastName}`,
    email: null,
    phone: null,
    subjects: opts.subjects ?? [],
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function seedStudentEntity(
  tenantId: string,
  uid: string,
  opts: {
    firstName: string;
    lastName: string;
    rollNumber: string;
    classIds?: string[];
  }
) {
  const ref = db().collection(`tenants/${tenantId}/students`).doc();
  await ref.set({
    id: ref.id,
    tenantId,
    authUid: uid,
    firstName: opts.firstName,
    lastName: opts.lastName,
    displayName: `${opts.firstName} ${opts.lastName}`,
    email: null,
    phone: null,
    rollNumber: opts.rollNumber,
    classIds: opts.classIds ?? [],
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}
