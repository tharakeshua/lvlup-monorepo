import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Firestore trigger: cascade delete when an exam is deleted.
 *
 * Cleans up:
 * - All submissions for this exam
 * - All questionSubmissions (subcollections of submissions)
 * - All examQuestions (subcollection of exam)
 * - Exam analytics document
 */
export const onExamDeleted = onDocumentDeleted(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    region: "asia-south1",
  },
  async (event) => {
    const { tenantId, examId } = event.params;
    const db = admin.firestore();

    logger.info(`Cascading delete for exam ${examId} in tenant ${tenantId}`);

    // Delete exam questions subcollection
    await deleteCollection(db, `tenants/${tenantId}/exams/${examId}/questions`);

    // Delete all submissions and their questionSubmissions
    const submissionsSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("examId", "==", examId)
      .get();

    for (const submissionDoc of submissionsSnap.docs) {
      // Delete questionSubmissions subcollection first
      await deleteCollection(db, `${submissionDoc.ref.path}/questionSubmissions`);
      await submissionDoc.ref.delete();
    }

    // Delete exam analytics if it exists
    const analyticsRef = db.doc(`tenants/${tenantId}/examAnalytics/${examId}`);
    const analyticsDoc = await analyticsRef.get();
    if (analyticsDoc.exists) {
      await analyticsRef.delete();
    }

    // Update tenant stats
    await db.doc(`tenants/${tenantId}`).update({
      "stats.totalExams": FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(
      `Cascade delete complete for exam ${examId}: ${submissionsSnap.size} submissions deleted`
    );
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
