import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";

/**
 * Firestore trigger: cascade delete when a space is deleted.
 *
 * Cleans up:
 * - All storyPoints
 * - All items (and their answerKeys subcollections)
 * - All agents
 * - All digitalTestSessions for this space
 * - All spaceProgress for this space
 * - All chatSessions for this space
 * - RTDB leaderboard data
 */
export const onSpaceDeleted = onDocumentDeleted(
  {
    document: "tenants/{tenantId}/spaces/{spaceId}",
    region: "asia-south1",
  },
  async (event) => {
    const { tenantId, spaceId } = event.params;
    const db = admin.firestore();

    logger.info(`Cascading delete for space ${spaceId} in tenant ${tenantId}`);

    // Delete storyPoints
    await deleteCollection(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`);

    // Delete items (and their answerKeys)
    const itemsSnap = await db.collection(`tenants/${tenantId}/spaces/${spaceId}/items`).get();

    for (const itemDoc of itemsSnap.docs) {
      // Delete answerKeys subcollection first
      await deleteCollection(db, `${itemDoc.ref.path}/answerKeys`);
      await itemDoc.ref.delete();
    }

    // Delete agents
    await deleteCollection(db, `tenants/${tenantId}/spaces/${spaceId}/agents`);

    // Delete test sessions for this space
    const sessionsSnap = await db
      .collection(`tenants/${tenantId}/digitalTestSessions`)
      .where("spaceId", "==", spaceId)
      .get();

    if (!sessionsSnap.empty) {
      await deleteDocs(db, sessionsSnap.docs);
    }

    // Delete space progress (including storyPointProgress subcollections)
    const progressSnap = await db
      .collection(`tenants/${tenantId}/spaceProgress`)
      .where("spaceId", "==", spaceId)
      .get();

    if (!progressSnap.empty) {
      for (const progressDoc of progressSnap.docs) {
        // Delete storyPointProgress subcollection first
        await deleteCollection(db, `${progressDoc.ref.path}/storyPointProgress`);
      }
      await deleteDocs(db, progressSnap.docs);
    }

    // Delete chat sessions for this space
    const chatSnap = await db
      .collection(`tenants/${tenantId}/chatSessions`)
      .where("spaceId", "==", spaceId)
      .get();

    if (!chatSnap.empty) {
      await deleteDocs(db, chatSnap.docs);
    }

    // Clean up RTDB leaderboard
    try {
      const rtdb = admin.database();
      await rtdb.ref(`leaderboards/${tenantId}/${spaceId}`).remove();
    } catch (err) {
      logger.warn("Failed to clean up RTDB leaderboard", err);
    }

    // Update tenant stats
    await db.doc(`tenants/${tenantId}`).update({
      "stats.totalSpaces": FieldValue.increment(-1),
      updatedAt: isoNow(),
    });

    logger.info(`Cascade delete complete for space ${spaceId}`);
  }
);

/**
 * Delete all documents in a collection using chunked batches (max 450 per batch).
 */
async function deleteCollection(db: admin.firestore.Firestore, path: string): Promise<void> {
  const snapshot = await db.collection(path).limit(450).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  // Recurse if there might be more
  if (snapshot.size === 450) {
    await deleteCollection(db, path);
  }
}

/**
 * Delete an array of document snapshots in chunked batches (max 450 per batch).
 */
async function deleteDocs(
  db: admin.firestore.Firestore,
  docs: admin.firestore.QueryDocumentSnapshot[]
): Promise<void> {
  for (let i = 0; i < docs.length; i += 450) {
    const chunk = docs.slice(i, i + 450);
    const batch = db.batch();
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}
