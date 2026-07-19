import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import type { UserMembership, TeacherPermissions } from "../contracts/legacy-docs";
import { DEFAULT_TEACHER_PERMISSIONS } from "../contracts/legacy-docs";
import { SaveTeacherRequestSchema, type SaveResponse } from "../contracts/wire";
import {
  assertTenantAdminOrSuperAdmin,
  getTenant,
  getUser,
  buildClaimsForMembership,
  parseRequest,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/** Nest boolean can* flags under `permissions` so domain UserMembershipSchema accepts the doc. */
function canonicalizeTeacherPermissions(raw: TeacherPermissions & Record<string, unknown>): {
  permissions: Record<string, boolean>;
  managedClassIds: string[];
  managedSpaceIds: string[];
} {
  const bag: Record<string, boolean> = {};
  const nested =
    raw.permissions && typeof raw.permissions === "object" && !Array.isArray(raw.permissions)
      ? (raw.permissions as Record<string, unknown>)
      : {};
  for (const src of [nested, raw as Record<string, unknown>]) {
    for (const [k, v] of Object.entries(src)) {
      if (k === "permissions" || k === "managedClassIds" || k === "managedSpaceIds") continue;
      if (typeof v === "boolean") bag[k] = v;
    }
  }
  return {
    permissions: bag,
    managedClassIds: Array.isArray(raw.managedClassIds) ? raw.managedClassIds : [],
    managedSpaceIds: Array.isArray(raw.managedSpaceIds) ? raw.managedSpaceIds : [],
  };
}

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
      // B8: timestamps at rest are canonical ISO strings.
      createdAt: isoNow(),
      createdBy: callerUid,
      updatedAt: isoNow(),
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
      // Domain TeacherPermissions is nested: { permissions?: Record, managedClassIds? }.
      // Never spread flat can* keys onto the wrapper — that breaks getMe Zod
      // (validateResponses:true → Access Denied after school login).
      permissions: canonicalizeTeacherPermissions({
        ...DEFAULT_TEACHER_PERMISSIONS,
        ...(data.permissions ?? {}),
        managedClassIds: data.classIds ?? [],
      }),
      createdAt: isoNow(),
      updatedAt: isoNow(),
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
      updatedAt: isoNow(),
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
          updatedAt: isoNow(),
        });
      }

      // Remove teacher from old classes
      for (const classId of removed) {
        const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
        await classRef.update({
          teacherIds: FieldValue.arrayRemove(id),
          updatedAt: isoNow(),
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

        const updatedPerms = canonicalizeTeacherPermissions({
          ...currentPerms,
          ...data.permissions,
          managedClassIds:
            (data.permissions as { managedClassIds?: string[] } | undefined)?.managedClassIds ??
            currentPerms.managedClassIds,
        });

        await membershipRef.update({
          permissions: updatedPerms,
          updatedAt: isoNow(),
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
          // Replaces claims wholesale — preserve isSuperAdmin (DEP-1 bug class).
          const teacherUser = await getUser(teacherUid);
          const claims = buildClaimsForMembership(updatedMembership, {
            isSuperAdmin: teacherUser?.isSuperAdmin === true,
          });
          await admin.auth().setCustomUserClaims(teacherUid, claims);
        }
      }
    }

    logger.info(`Updated teacher ${id} in tenant ${tenantId}`);

    return { id, created: false } satisfies SaveResponse;
  }
});
