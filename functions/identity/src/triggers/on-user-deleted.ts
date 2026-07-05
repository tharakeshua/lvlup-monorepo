import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import type { UserMembership } from "../contracts/legacy-docs";
import { updateTenantStats } from "../utils/firestore-helpers";

/**
 * Auth trigger: runs when a Firebase Auth account is deleted.
 * Soft-deletes the user doc and deactivates all memberships.
 */
export const onUserDeleted = functions
  .region("asia-south1")
  .auth.user()
  .onDelete(async (user) => {
    try {
      const batch = admin.firestore().batch();

      // 1. Soft-delete user doc
      const userRef = admin.firestore().doc(`users/${user.uid}`);
      batch.update(userRef, {
        status: "deleted",
        // B8: timestamps at rest are canonical ISO strings.
        updatedAt: isoNow(),
      });

      // 2. Deactivate all memberships
      const membershipsQuery = await admin
        .firestore()
        .collection("userMemberships")
        .where("uid", "==", user.uid)
        .get();

      for (const doc of membershipsQuery.docs) {
        batch.update(doc.ref, {
          status: "inactive",
          updatedAt: isoNow(),
        });
      }

      await batch.commit();

      // 3. Update tenant stats (outside batch)
      for (const doc of membershipsQuery.docs) {
        const m = doc.data() as UserMembership;
        await updateTenantStats(m.tenantId, m.role, "decrement");
      }

      logger.info(
        `Soft-deleted user ${user.uid}, deactivated ${membershipsQuery.size} memberships`
      );
    } catch (error) {
      logger.error(`Failed to handle deletion of user ${user.uid}`, error);
    }
  });
