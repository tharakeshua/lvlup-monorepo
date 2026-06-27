import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SaveClassRequestSchema } from "@levelup/shared-types";
import type { SaveResponse } from "@levelup/shared-types";
import { assertTenantAdminOrSuperAdmin, getTenant, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint: replaces createClass + updateClass + deleteClass.
 * - No id = create new class
 * - id present = update existing class
 * - data.status = 'deleted' = soft-delete (archives + decrements stats)
 */
export const saveClass = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { id, tenantId, data } = parseRequest(request.data, SaveClassRequestSchema);

  await assertTenantAdminOrSuperAdmin(callerUid, tenantId);

  await enforceRateLimit(tenantId, callerUid, "write", 30);

  if (!id) {
    // ── CREATE ──
    const tenant = await getTenant(tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new HttpsError("not-found", "Tenant not found or inactive");
    }

    if (!data.name || !data.grade) {
      throw new HttpsError("invalid-argument", "Name and grade are required");
    }

    const classRef = admin.firestore().collection(`tenants/${tenantId}/classes`).doc();

    await classRef.set({
      id: classRef.id,
      tenantId,
      name: data.name,
      grade: data.grade,
      section: data.section ?? null,
      academicSessionId: data.academicSessionId ?? null,
      teacherIds: data.teacherIds ?? [],
      studentIds: [],
      studentCount: 0,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    });

    await admin
      .firestore()
      .doc(`tenants/${tenantId}`)
      .update({
        "stats.totalClasses": FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });

    logger.info(`Created class ${classRef.id} in tenant ${tenantId}`);

    return { id: classRef.id, created: true } satisfies SaveResponse;
  } else {
    // ── UPDATE (including soft-delete) ──
    const classRef = admin.firestore().doc(`tenants/${tenantId}/classes/${id}`);

    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      throw new HttpsError("not-found", "Class not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.grade !== undefined) updates.grade = data.grade;
    if (data.section !== undefined) updates.section = data.section;
    if (data.academicSessionId !== undefined) updates.academicSessionId = data.academicSessionId;
    if (data.teacherIds !== undefined) updates.teacherIds = data.teacherIds;
    if (data.status !== undefined) updates.status = data.status;

    await classRef.update(updates);

    // If soft-deleting, decrement tenant stats
    const previousStatus = classDoc.data()?.status;
    if (data.status === "deleted" && previousStatus !== "deleted") {
      await admin
        .firestore()
        .doc(`tenants/${tenantId}`)
        .update({
          "stats.totalClasses": FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
    }

    logger.info(`Updated class ${id} in tenant ${tenantId}`);

    return { id, created: false } satisfies SaveResponse;
  }
});
