import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SaveParentRequestSchema } from "@levelup/shared-types";
import type { SaveResponse } from "@levelup/shared-types";
import { assertTenantAdminOrSuperAdmin, getTenant, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint: replaces createParent + linkParentToStudent.
 * - No id = create new parent
 * - id present = update (childStudentIds manages parent-student links)
 */
export const saveParent = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { id, tenantId, data } = parseRequest(request.data, SaveParentRequestSchema);

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

    const parentRef = db.collection(`tenants/${tenantId}/parents`).doc();
    const childStudentIds = data.childStudentIds ?? [];

    await parentRef.set({
      id: parentRef.id,
      tenantId,
      uid: data.uid,
      childStudentIds,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    });

    // Link parent to students (add parentId to each student)
    for (const studentId of childStudentIds) {
      const studentRef = db.doc(`tenants/${tenantId}/students/${studentId}`);
      await studentRef.update({
        parentIds: FieldValue.arrayUnion(parentRef.id),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info(`Created parent ${parentRef.id} in tenant ${tenantId}`);

    return { id: parentRef.id, created: true } satisfies SaveResponse;
  } else {
    // ── UPDATE ──
    const parentRef = db.doc(`tenants/${tenantId}/parents/${id}`);
    const parentDoc = await parentRef.get();
    if (!parentDoc.exists) {
      throw new HttpsError("not-found", "Parent not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    };

    if (data.status !== undefined) updates.status = data.status;

    // Handle childStudentIds changes (replaces linkParentToStudent)
    if (data.childStudentIds !== undefined) {
      const previousChildIds: string[] = parentDoc.data()?.childStudentIds ?? [];
      const newChildIds = data.childStudentIds;
      updates.childStudentIds = newChildIds;

      const added = newChildIds.filter((s) => !previousChildIds.includes(s));
      const removed = previousChildIds.filter((s) => !newChildIds.includes(s));

      // Add parentId to newly linked students
      for (const studentId of added) {
        const studentRef = db.doc(`tenants/${tenantId}/students/${studentId}`);
        await studentRef.update({
          parentIds: FieldValue.arrayUnion(id),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Remove parentId from unlinked students
      for (const studentId of removed) {
        const studentRef = db.doc(`tenants/${tenantId}/students/${studentId}`);
        await studentRef.update({
          parentIds: FieldValue.arrayRemove(id),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await parentRef.update(updates);

    logger.info(`Updated parent ${id} in tenant ${tenantId}`);

    return { id, created: false } satisfies SaveResponse;
  }
});
