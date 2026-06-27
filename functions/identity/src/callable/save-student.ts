import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import type { UserMembership, MembershipClaimsInput } from "@levelup/shared-types";
import { SaveStudentRequestSchema } from "@levelup/shared-types";
import type { SaveResponse } from "@levelup/shared-types";
import {
  assertTenantAdminOrSuperAdmin,
  getTenant,
  buildClaimsForMembership,
  parseRequest,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint: replaces createStudent + updateStudent + deleteStudent + assignStudentToClass.
 * - No id = create new student
 * - id present = update existing student (including classIds assignment and soft-delete via status)
 */
export const saveStudent = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { id, tenantId, data } = parseRequest(request.data, SaveStudentRequestSchema);

  await assertTenantAdminOrSuperAdmin(callerUid, tenantId);

  await enforceRateLimit(tenantId, callerUid, "write", 30);

  const db = admin.firestore();

  if (!id) {
    // ── CREATE ──
    const tenant = await getTenant(tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new HttpsError("not-found", "Tenant not found or inactive");
    }

    if (!data.uid) {
      throw new HttpsError("invalid-argument", "uid is required");
    }

    const studentRef = db.collection(`tenants/${tenantId}/students`).doc();
    const classIds = data.classIds ?? [];

    await studentRef.set({
      id: studentRef.id,
      tenantId,
      uid: data.uid,
      rollNumber: data.rollNumber ?? null,
      section: data.section ?? null,
      classIds,
      parentIds: data.parentIds ?? [],
      grade: data.grade ?? null,
      admissionNumber: data.admissionNumber ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    });

    // Create UserMembership
    const membershipId = `${data.uid}_${tenantId}`;
    const membership = {
      id: membershipId,
      uid: data.uid,
      tenantId,
      tenantCode: tenant!.tenantCode,
      role: "student" as const,
      status: "active" as const,
      joinSource: "admin_created" as const,
      studentId: studentRef.id,
      permissions: {
        managedClassIds: classIds,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.doc(`userMemberships/${membershipId}`).set(membership);

    // Set custom claims — use MembershipClaimsInput to avoid double-cast
    const claimsInput: MembershipClaimsInput = {
      role: membership.role,
      tenantId: membership.tenantId,
      tenantCode: membership.tenantCode,
      permissions: membership.permissions,
      staffPermissions: undefined,
      teacherId: undefined,
      studentId: membership.studentId,
      parentId: undefined,
      parentLinkedStudentIds: undefined,
      staffId: undefined,
      scannerId: undefined,
    };
    const claims = buildClaimsForMembership(claimsInput);
    const existingUser = await admin.auth().getUser(data.uid);
    const existingClaims = existingUser.customClaims ?? {};
    await admin.auth().setCustomUserClaims(data.uid, { ...existingClaims, ...claims });

    // Add student to each assigned class
    for (const classId of classIds) {
      const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
      await classRef.update({
        studentIds: FieldValue.arrayUnion(studentRef.id),
        studentCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info(`Created student ${studentRef.id} in tenant ${tenantId}`);

    return { id: studentRef.id, created: true } satisfies SaveResponse;
  } else {
    // ── UPDATE ──
    const studentRef = db.doc(`tenants/${tenantId}/students/${id}`);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) {
      throw new HttpsError("not-found", "Student not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    };

    if (data.rollNumber !== undefined) updates.rollNumber = data.rollNumber;
    if (data.section !== undefined) updates.section = data.section;
    if (data.parentIds !== undefined) updates.parentIds = data.parentIds;
    if (data.grade !== undefined) updates.grade = data.grade;
    if (data.admissionNumber !== undefined) updates.admissionNumber = data.admissionNumber;
    if (data.dateOfBirth !== undefined) updates.dateOfBirth = data.dateOfBirth;
    if (data.status !== undefined) updates.status = data.status;

    // Handle classIds reassignment (replaces assignStudentToClass)
    if (data.classIds !== undefined) {
      const previousClassIds: string[] = studentDoc.data()?.classIds ?? [];
      const newClassIds = data.classIds;
      updates.classIds = newClassIds;

      const added = newClassIds.filter((c) => !previousClassIds.includes(c));
      const removed = previousClassIds.filter((c) => !newClassIds.includes(c));

      // Add student to new classes
      for (const classId of added) {
        const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
        await classRef.update({
          studentIds: FieldValue.arrayUnion(id),
          studentCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Remove student from old classes
      for (const classId of removed) {
        const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
        await classRef.update({
          studentIds: FieldValue.arrayRemove(id),
          studentCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await studentRef.update(updates);

    logger.info(`Updated student ${id} in tenant ${tenantId}`);

    return { id, created: false } satisfies SaveResponse;
  }
});
