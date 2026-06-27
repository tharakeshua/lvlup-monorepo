import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { SaveQuestionBankItemRequestSchema } from "@levelup/shared-types";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Create, update, or delete a question bank item.
 *
 * Save* pattern: id absent = create, id present = update,
 * data.deleted = true = soft delete.
 */
export const saveQuestionBankItem = onCall(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = assertAuth(request.auth);
    const data = parseRequest(request.data, SaveQuestionBankItemRequestSchema);

    if (!data.tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }

    await assertTeacherOrAdmin(callerUid, data.tenantId);
    await enforceRateLimit(data.tenantId, callerUid, "write", 30);

    const db = admin.firestore();
    const collPath = `tenants/${data.tenantId}/questionBank`;

    // DELETE
    if (data.id && data.data.deleted) {
      await db.doc(`${collPath}/${data.id}`).delete();
      logger.info(`Deleted question bank item ${data.id}`);
      return { id: data.id, deleted: true };
    }

    // UPDATE
    if (data.id) {
      const ref = db.doc(`${collPath}/${data.id}`);
      const existing = await ref.get();
      if (!existing.exists) {
        throw new HttpsError("not-found", "Question bank item not found");
      }

      const updateData: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only update provided fields
      const fields = [
        "questionType",
        "title",
        "content",
        "explanation",
        "basePoints",
        "questionData",
        "subject",
        "topics",
        "difficulty",
        "bloomsLevel",
        "tags",
      ] as const;
      for (const field of fields) {
        if (data.data[field] !== undefined) {
          updateData[field] = data.data[field];
        }
      }

      await ref.update(updateData);
      logger.info(`Updated question bank item ${data.id}`);
      return { id: data.id, created: false };
    }

    // CREATE
    if (!data.data.questionType || !data.data.content) {
      throw new HttpsError(
        "invalid-argument",
        "questionType and content are required for new items"
      );
    }

    const ref = db.collection(collPath).doc();
    await ref.set({
      id: ref.id,
      tenantId: data.tenantId,
      questionType: data.data.questionType,
      title: data.data.title ?? "",
      content: data.data.content,
      explanation: data.data.explanation ?? null,
      basePoints: data.data.basePoints ?? 1,
      questionData: data.data.questionData ?? {},
      subject: data.data.subject ?? "",
      topics: data.data.topics ?? [],
      difficulty: data.data.difficulty ?? "medium",
      bloomsLevel: data.data.bloomsLevel ?? null,
      tags: data.data.tags ?? [],
      usageCount: 0,
      averageScore: null,
      lastUsedAt: null,
      createdBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Created question bank item ${ref.id}`);
    return { id: ref.id, created: true };
  }
);
