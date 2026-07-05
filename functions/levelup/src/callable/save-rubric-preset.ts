import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { isoNow } from "@levelup/domain";
import { SaveRubricPresetRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Create, update, or delete a rubric preset.
 * Save* pattern: id absent = create, id present = update,
 * data.deleted = true = soft delete.
 */
export const saveRubricPreset = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const data = parseRequest(request.data, SaveRubricPresetRequestSchema);

  if (!data.tenantId) {
    throw new HttpsError("invalid-argument", "tenantId is required");
  }

  await assertTeacherOrAdmin(callerUid, data.tenantId);
  await enforceRateLimit(data.tenantId, callerUid, "write", 30);

  const db = admin.firestore();
  const collPath = `tenants/${data.tenantId}/rubricPresets`;

  // DELETE
  if (data.id && data.data.deleted) {
    const existing = await db.doc(`${collPath}/${data.id}`).get();
    if (existing.exists && existing.data()?.isDefault) {
      throw new HttpsError("failed-precondition", "Cannot delete default presets");
    }
    await db.doc(`${collPath}/${data.id}`).delete();
    logger.info(`Deleted rubric preset ${data.id}`);
    return { id: data.id, deleted: true };
  }

  // UPDATE
  if (data.id) {
    const ref = db.doc(`${collPath}/${data.id}`);
    const existing = await ref.get();
    if (!existing.exists) {
      throw new HttpsError("not-found", "Rubric preset not found");
    }

    const updateData: Record<string, unknown> = {
      updatedAt: isoNow(),
    };

    const fields = ["name", "description", "rubric", "category", "questionTypes"] as const;
    for (const field of fields) {
      if (data.data[field] !== undefined) {
        updateData[field] = data.data[field];
      }
    }

    await ref.update(updateData);
    logger.info(`Updated rubric preset ${data.id}`);
    return { id: data.id, created: false };
  }

  // CREATE
  if (!data.data.name || !data.data.rubric) {
    throw new HttpsError("invalid-argument", "name and rubric are required for new presets");
  }

  const ref = db.collection(collPath).doc();
  await ref.set({
    id: ref.id,
    tenantId: data.tenantId,
    name: data.data.name,
    description: data.data.description ?? "",
    rubric: data.data.rubric,
    category: data.data.category ?? "custom",
    questionTypes: data.data.questionTypes ?? [],
    isDefault: false,
    createdBy: callerUid,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  });

  logger.info(`Created rubric preset ${ref.id}`);
  return { id: ref.id, created: true };
});
