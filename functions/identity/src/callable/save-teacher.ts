import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import type { UserMembership, TeacherPermissions } from "@levelup/shared-types";
import { DEFAULT_TEACHER_PERMISSIONS } from "@levelup/shared-types";
import { SaveTeacherRequestSchema } from "@levelup/shared-types";
import type { SaveResponse } from "@levelup/shared-types";
import {
  assertTenantAdminOrSuperAdmin,
  getTenant,
  buildClaimsForMembership,
  parseRequest,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint: replaces createTeacher + updateTeacher + assignTeacherToClass + updateTeacherPermissions.
 * - No id = create new teacher
 * - id present = update (including classIds assignment, permissions, soft-delete)
 */
export const saveTeacher = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { id, tenantId, data } = parseRequest(request.data, SaveTeacherRequestSchema);

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

    const teacherRef = db.collection(`tenants/${tenantId}/teachers`).doc();

    await teacherRef.set({
      id: teacherRef.id,
      tenantId,
      uid: data.uid,
      subjects: data.subjects ?? [],
      designation: data.designation ?? null,
      classIds: data.classIds ?? [],
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    });

    // Create UserMembership
    const membershipId = `${data.uid}_${tenantId}`;
    const membership: Omit<UserMembership, "createdAt" | "updatedAt"> & Record<string, unknown> = {
      id: membershipId,
      uid: data.uid,
      tenantId,
      tenantCode: tenant!.tenantCode,
      role: "teacher",
      status: "active",
      joinSource: "admin_created",
      teacherId: teacherRef.id,
      permissions: {
        ...DEFAULT_TEACHER_PERMISSIONS,
        managedClassIds: data.classIds ?? [],
        ...(data.permissions ?? {}),
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.doc(`userMemberships/${membershipId}`).set(membership);

    // Set custom claims
    const claims = buildClaimsForMembership(membership);
    const existingUser = await admin.auth().getUser(data.uid);
    const existingClaims = existingUser.customClaims ?? {};
    await admin.auth().setCustomUserClaims(data.uid, { ...existingClaims, ...claims });

    logger.info(`Created teacher ${teacherRef.id} in tenant ${tenantId}`);

    return { id: teacherRef.id, created: true } satisfies SaveResponse;
  } else {
    // ── UPDATE ──
    const teacherRef = db.doc(`tenants/${tenantId}/teachers/${id}`);
    const teacherDoc = await teacherRef.get();
    if (!teacherDoc.exists) {
      throw new HttpsError("not-found", "Teacher not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    };

    if (data.subjects !== undefined) updates.subjects = data.subjects;
    if (data.designation !== undefined) updates.designation = data.designation;
    if (data.status !== undefined) updates.status = data.status;

    // Handle classIds reassignment (replaces assignTeacherToClass)
    if (data.classIds !== undefined) {
      const previousClassIds: string[] = teacherDoc.data()?.classIds ?? [];
      const newClassIds = data.classIds;
      updates.classIds = newClassIds;

      const added = newClassIds.filter((c) => !previousClassIds.includes(c));
      const removed = previousClassIds.filter((c) => !newClassIds.includes(c));

      // Add teacher to new classes
      for (const classId of added) {
        const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
        await classRef.update({
          teacherIds: FieldValue.arrayUnion(id),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Remove teacher from old classes
      for (const classId of removed) {
        const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
        await classRef.update({
          teacherIds: FieldValue.arrayRemove(id),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await teacherRef.update(updates);

    // Handle permissions update (replaces updateTeacherPermissions)
    if (data.permissions !== undefined) {
      const teacherData = teacherDoc.data()!;
      const teacherUid = teacherData.uid as string;
      const membershipRef = db.doc(`userMemberships/${teacherUid}_${tenantId}`);
      const membershipDoc = await membershipRef.get();

      if (membershipDoc.exists && membershipDoc.data()?.role === "teacher") {
        const currentMembership = membershipDoc.data() as UserMembership;
        const currentPerms = currentMembership.permissions ?? {};

        const updatedPerms: TeacherPermissions = {
          ...currentPerms,
          ...data.permissions,
        };

        await membershipRef.update({
          permissions: updatedPerms,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Refresh claims if classIds changed
        const classIdsChanged =
          JSON.stringify(currentPerms.managedClassIds) !==
          JSON.stringify(updatedPerms.managedClassIds);

        if (classIdsChanged) {
          const updatedMembership = {
            ...currentMembership,
            permissions: updatedPerms,
          };
          const claims = buildClaimsForMembership(updatedMembership);
          await admin.auth().setCustomUserClaims(teacherUid, claims);
        }
      }
    }

    logger.info(`Updated teacher ${id} in tenant ${tenantId}`);

    return { id, created: false } satisfies SaveResponse;
  }
});
