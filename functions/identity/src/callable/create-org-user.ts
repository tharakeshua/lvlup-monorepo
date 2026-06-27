import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import type { TenantRole } from "@levelup/shared-types";
import { CreateOrgUserRequestSchema } from "@levelup/shared-types";
import {
  getUser,
  getMembership,
  getTenant,
  updateTenantStats,
  assertTenantAdminOrSuperAdmin,
  assertTenantAccessible,
  buildClaimsForMembership,
  sanitizeRollNumber,
  generateTempPassword,
  determineProvider,
  parseRequest,
  assertQuota,
  logTenantAction,
  writePlatformActivity,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { incrementUsage } from "../utils/usage";
import type { StaffPermissions } from "@levelup/shared-types";
import { DEFAULT_STAFF_PERMISSIONS } from "@levelup/shared-types";

interface CreateOrgUserRequest {
  tenantId: string;
  role: TenantRole;
  email?: string;
  rollNumber?: string;
  firstName: string;
  lastName: string;
  password?: string;
  phone?: string;
  classIds?: string[];
  subjects?: string[];
  linkedStudentIds?: string[];
}

interface CreateOrgUserResponse {
  uid: string;
  entityId: string;
  membershipId: string;
}

/**
 * createOrgUser — Creates a new user within a tenant organization.
 *
 * Creates the Firebase Auth user, tenant entity doc (student/teacher/parent),
 * and UserMembership doc in a single flow.
 */
export const createOrgUser = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const data = parseRequest(request.data, CreateOrgUserRequestSchema);

  if (!data.tenantId || !data.role || !data.firstName || !data.lastName) {
    throw new HttpsError(
      "invalid-argument",
      "tenantId, role, firstName, and lastName are required"
    );
  }

  await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);

  await enforceRateLimit(data.tenantId, callerUid, "write", 30);

  const tenant = await getTenant(data.tenantId);
  assertTenantAccessible(tenant, "write");

  // Enforce subscription quota for student/teacher creation
  if (data.role === "student" || data.role === "teacher") {
    await assertQuota(data.tenantId, data.role);
  }

  const db = admin.firestore();
  const tenantCode = tenant!.tenantCode;

  // Determine email for auth account
  let email = data.email;
  let password = data.password ?? generateTempPassword();

  if (!email && data.role === "student" && data.rollNumber) {
    // Generate synthetic email for students without email
    const sanitized = sanitizeRollNumber(data.rollNumber);
    email = `${sanitized}@${data.tenantId}.levelup.internal`;
  }

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "email or rollNumber is required to create an auth account"
    );
  }

  // Create Firebase Auth user
  let authUser: admin.auth.UserRecord;
  try {
    authUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${data.firstName} ${data.lastName}`,
      disabled: false,
    });
  } catch (err: unknown) {
    const authErr = err as { code?: string };
    if (authErr.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", `User with email ${email} already exists`);
    }
    throw new HttpsError("internal", `Failed to create auth user: ${(err as Error).message}`);
  }

  const uid = authUser.uid;

  try {
    // Create the tenant-specific entity doc
    let entityId: string;
    const entityBase = {
      tenantId: data.tenantId,
      name: `${data.firstName} ${data.lastName}`,
      uid,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (data.role === "student") {
      const studentRef = db.collection(`tenants/${data.tenantId}/students`).doc();
      entityId = studentRef.id;
      await studentRef.set({
        id: studentRef.id,
        ...entityBase,
        rollNumber: data.rollNumber ?? "",
        classIds: data.classIds ?? [],
        parentIds: [],
      });
    } else if (data.role === "teacher") {
      const teacherRef = db.collection(`tenants/${data.tenantId}/teachers`).doc();
      entityId = teacherRef.id;
      await teacherRef.set({
        id: teacherRef.id,
        ...entityBase,
        subjects: data.subjects ?? [],
        classIds: data.classIds ?? [],
        designation: null,
      });
    } else if (data.role === "parent") {
      const parentRef = db.collection(`tenants/${data.tenantId}/parents`).doc();
      entityId = parentRef.id;
      await parentRef.set({
        id: parentRef.id,
        ...entityBase,
        childStudentIds: data.linkedStudentIds ?? [],
      });
    } else if (data.role === "staff") {
      const staffRef = db.collection(`tenants/${data.tenantId}/staff`).doc();
      entityId = staffRef.id;
      await staffRef.set({
        id: staffRef.id,
        ...entityBase,
        department: null,
      });
    } else if (data.role === "scanner") {
      const scannerRef = db.collection(`tenants/${data.tenantId}/scanners`).doc();
      entityId = scannerRef.id;
      await scannerRef.set({
        id: scannerRef.id,
        ...entityBase,
      });
    } else {
      throw new HttpsError("invalid-argument", `Unsupported role: ${data.role}`);
    }

    // Create UserMembership
    const membershipId = `${uid}_${data.tenantId}`;
    const membershipRef = db.doc(`userMemberships/${membershipId}`);

    const membership = {
      id: membershipId,
      uid,
      tenantId: data.tenantId,
      tenantCode,
      role: data.role,
      status: "active" as const,
      joinSource: "admin_created" as const,
      ...(data.role === "student" && { studentId: entityId }),
      ...(data.role === "teacher" && {
        teacherId: entityId,
        permissions: { managedClassIds: data.classIds ?? [] },
      }),
      ...(data.role === "parent" && {
        parentId: entityId,
        parentLinkedStudentIds: data.linkedStudentIds ?? [],
      }),
      ...(data.role === "staff" && {
        staffId: entityId,
        staffPermissions: DEFAULT_STAFF_PERMISSIONS,
      }),
      ...(data.role === "scanner" && { scannerId: entityId }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await membershipRef.set(membership);

    // Set custom claims
    const claims = buildClaimsForMembership(membership);
    await admin.auth().setCustomUserClaims(uid, claims);

    // Update tenant stats
    await updateTenantStats(data.tenantId, data.role, "increment");

    // Update real-time usage counters
    if (data.role === "student") {
      await incrementUsage(data.tenantId, "currentStudents", 1);
    } else if (data.role === "teacher") {
      await incrementUsage(data.tenantId, "currentTeachers", 1);
    }

    // Create platform user doc if it doesn't exist
    const userRef = db.doc(`users/${uid}`);
    const existingUser = await userRef.get();
    if (!existingUser.exists) {
      await userRef.set({
        uid,
        email,
        displayName: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        authProvider: determineProvider(authUser),
        isSuperAdmin: false,
        activeTenantId: data.tenantId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info(`Created org user ${uid} as ${data.role} in tenant ${data.tenantId}`);

    await logTenantAction(data.tenantId, callerUid, "createOrgUser", {
      uid,
      role: data.role,
      entityId,
    });

    await writePlatformActivity(
      "user_created",
      callerUid,
      {
        uid,
        role: data.role,
        displayName: `${data.firstName} ${data.lastName}`,
      },
      data.tenantId
    );

    return { uid, entityId, membershipId } satisfies CreateOrgUserResponse;
  } catch (err) {
    // Cleanup auth user on failure
    try {
      await admin.auth().deleteUser(uid);
    } catch {
      logger.warn(`Failed to cleanup auth user ${uid} after entity creation failure`);
    }
    throw err;
  }
});
