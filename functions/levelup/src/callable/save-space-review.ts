import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAuth, assertTenantMember } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { parseRequest } from "../utils";
import { isoNow } from "@levelup/domain";
import { SaveSpaceReviewRequestSchema } from "../contracts/wire";

/**
 * Save or update a space review (one review per user per space).
 * Also updates the denormalized rating aggregate on the Space document.
 */
export const saveSpaceReview = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const { tenantId, spaceId, rating, comment } = parseRequest(
    request.data,
    SaveSpaceReviewRequestSchema
  );

  await assertTenantMember(callerUid, tenantId);
  await enforceRateLimit(tenantId, callerUid, "write", 10);

  const db = admin.firestore();
  const reviewRef = db.doc(`tenants/${tenantId}/spaces/${spaceId}/reviews/${callerUid}`);
  const spaceRef = db.doc(`tenants/${tenantId}/spaces/${spaceId}`);

  // Check space exists
  const spaceDoc = await spaceRef.get();
  if (!spaceDoc.exists) {
    throw new HttpsError("not-found", "Space not found");
  }

  const now = isoNow();
  const existingReview = await reviewRef.get();
  const isUpdate = existingReview.exists;

  // Get user display name
  const userDoc = await db.doc(`users/${callerUid}`).get();
  const userName = userDoc.exists ? (userDoc.data()?.displayName ?? "Anonymous") : "Anonymous";

  // Save/update the review
  const reviewData = {
    id: callerUid,
    spaceId,
    tenantId,
    userId: callerUid,
    userName,
    rating,
    comment: comment?.trim() || null,
    updatedAt: now,
    ...(isUpdate ? {} : { createdAt: now }),
  };

  await reviewRef.set(reviewData, { merge: true });

  // Recompute aggregate from all reviews
  const allReviews = await db.collection(`tenants/${tenantId}/spaces/${spaceId}/reviews`).get();
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;
  let totalReviews = 0;

  for (const doc of allReviews.docs) {
    const r = doc.data().rating as number;
    if (r >= 1 && r <= 5) {
      distribution[r] = (distribution[r] || 0) + 1;
      totalRating += r;
      totalReviews++;
    }
  }

  const averageRating = totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;

  await spaceRef.update({
    ratingAggregate: { averageRating, totalReviews, distribution },
    updatedAt: now,
  });

  return { success: true, isUpdate };
});
