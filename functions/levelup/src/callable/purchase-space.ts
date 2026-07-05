import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth } from "../utils/auth";
import { isoNow } from "@levelup/domain";
import { PurchaseSpaceRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

interface PurchaseSpaceRequest {
  spaceId: string;
  /** Reserved for future payment gateway integration. */
  paymentToken?: string;
}

/**
 * Consumer purchases a space from the public store.
 * MVP: no actual payment processing — just records the purchase.
 * Adds spaceId to user.consumerProfile.enrolledSpaceIds and appends a PurchaseRecord.
 */
export const purchaseSpace = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const data = parseRequest(request.data, PurchaseSpaceRequestSchema);

  if (!data.spaceId) {
    throw new HttpsError("invalid-argument", "spaceId is required");
  }

  await enforceRateLimit("platform_public", callerUid, "write", 30);

  const db = admin.firestore();

  // Load the store space
  const storeSpaceRef = db.doc(`tenants/platform_public/spaces/${data.spaceId}`);
  const storeSpaceDoc = await storeSpaceRef.get();

  if (!storeSpaceDoc.exists) {
    throw new HttpsError("not-found", "Space not found in the store");
  }

  const storeSpace = storeSpaceDoc.data()!;
  if (!storeSpace.publishedToStore) {
    throw new HttpsError("failed-precondition", "Space is not available for purchase");
  }

  // Check user hasn't already enrolled
  const userRef = db.doc(`users/${callerUid}`);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found");
  }

  const userData = userDoc.data()!;
  const existingEnrolled: string[] = userData.consumerProfile?.enrolledSpaceIds ?? [];

  if (existingEnrolled.includes(data.spaceId)) {
    throw new HttpsError("already-exists", "You are already enrolled in this space");
  }

  // Build purchase record
  const transactionId = db.collection("_transactions").doc().id;
  const purchaseRecord = {
    spaceId: data.spaceId,
    spaceTitle: storeSpace.title || "",
    amount: storeSpace.price ?? 0,
    currency: storeSpace.currency ?? "USD",
    purchasedAt: isoNow(),
    transactionId,
  };

  // Update user document atomically
  await userRef.update({
    "consumerProfile.enrolledSpaceIds": FieldValue.arrayUnion(data.spaceId),
    "consumerProfile.purchaseHistory": FieldValue.arrayUnion(purchaseRecord),
    "consumerProfile.totalSpend": FieldValue.increment(storeSpace.price ?? 0),
    updatedAt: isoNow(),
  });

  // Increment store space student count
  await storeSpaceRef.update({
    "stats.totalStudents": FieldValue.increment(1),
    updatedAt: isoNow(),
  });

  logger.info(`Consumer ${callerUid} purchased space ${data.spaceId} (txn: ${transactionId})`);

  return { success: true, transactionId };
});
