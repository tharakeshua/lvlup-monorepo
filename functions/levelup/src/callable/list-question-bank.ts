import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { ListQuestionBankRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * List/search question bank items with filtering and pagination.
 */
export const listQuestionBank = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const data = parseRequest(request.data, ListQuestionBankRequestSchema);

  if (!data.tenantId) {
    throw new HttpsError("invalid-argument", "tenantId is required");
  }

  await assertTeacherOrAdmin(callerUid, data.tenantId);
  await enforceRateLimit(data.tenantId, callerUid, "read", 60);

  const db = admin.firestore();
  let query: admin.firestore.Query = db.collection(`tenants/${data.tenantId}/questionBank`);

  // Apply filters
  if (data.subject) {
    query = query.where("subject", "==", data.subject);
  }
  if (data.difficulty) {
    query = query.where("difficulty", "==", data.difficulty);
  }
  if (data.bloomsLevel) {
    query = query.where("bloomsLevel", "==", data.bloomsLevel);
  }
  if (data.questionType) {
    query = query.where("questionType", "==", data.questionType);
  }

  // Sort
  const sortField = data.sortBy ?? "createdAt";
  const sortDir = data.sortDir ?? "desc";
  query = query.orderBy(sortField, sortDir);

  // Pagination
  if (data.startAfter) {
    const lastDoc = await db.doc(`tenants/${data.tenantId}/questionBank/${data.startAfter}`).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  const limit = Math.min(data.limit ?? 20, 50);
  query = query.limit(limit);

  const snapshot = await query.get();
  let items = snapshot.docs.map((doc) => doc.data());

  // Client-side filters for array fields (Firestore limitation)
  if (data.topics && data.topics.length > 0) {
    items = items.filter((item) =>
      data.topics!.some((t) => (item.topics as string[])?.includes(t))
    );
  }
  if (data.tags && data.tags.length > 0) {
    items = items.filter((item) => data.tags!.some((t) => (item.tags as string[])?.includes(t)));
  }

  // Client-side text search (simple substring match)
  if (data.search) {
    const searchLower = data.search.toLowerCase();
    items = items.filter((item) => {
      const title = ((item.title as string) ?? "").toLowerCase();
      const content = ((item.content as string) ?? "").toLowerCase();
      return title.includes(searchLower) || content.includes(searchLower);
    });
  }

  return {
    items,
    hasMore: snapshot.docs.length === limit,
    lastId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
  };
});
