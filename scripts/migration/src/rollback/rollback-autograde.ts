/**
 * Rollback AutoGrade migration: delete migrated tenant data.
 *
 * Only deletes documents that have the _migratedFrom: 'autograde' marker.
 * This ensures we don't delete any data that was created natively.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { MigrationLogger } from "../utils/logger.js";

const BATCH_SIZE = 500;

async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  logger: MigrationLogger,
  dryRun: boolean,
  filterField?: string,
  filterValue?: string
): Promise<number> {
  let deleted = 0;
  let query: admin.firestore.Query = db
    .collection(collectionPath)
    .where("_migratedFrom", "==", "autograde");

  if (filterField && filterValue) {
    query = query.where(filterField, "==", filterValue);
  }

  while (true) {
    const snapshot = await query.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    if (dryRun) {
      logger.info(`[DRY RUN] Would delete ${snapshot.size} docs from ${collectionPath}`);
      deleted += snapshot.size;
      break; // In dry run, just report the first batch
    }

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;
    logger.info(`Deleted ${snapshot.size} docs from ${collectionPath} (total: ${deleted})`);

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  return deleted;
}

export async function rollbackAutograde(options: {
  clientId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = clientId;

  logger.info(`Rolling back AutoGrade migration for client ${clientId}`);
  if (dryRun) logger.info("[DRY RUN MODE]");

  // Delete in reverse dependency order

  // 1. Delete question submissions (subcollections)
  const submissionsSnap = await db
    .collection(`tenants/${tenantId}/submissions`)
    .where("_migratedFrom", "==", "autograde")
    .get();
  for (const subDoc of submissionsSnap.docs) {
    await deleteCollection(
      db,
      `tenants/${tenantId}/submissions/${subDoc.id}/questionSubmissions`,
      logger,
      dryRun
    );
  }

  // 2. Delete submissions
  let total = await deleteCollection(db, `tenants/${tenantId}/submissions`, logger, dryRun);
  logger.info(`Deleted ${total} submissions`);

  // 3. Delete exam questions (subcollections)
  const examsSnap = await db
    .collection(`tenants/${tenantId}/exams`)
    .where("_migratedFrom", "==", "autograde")
    .get();
  for (const examDoc of examsSnap.docs) {
    await deleteCollection(db, `tenants/${tenantId}/exams/${examDoc.id}/questions`, logger, dryRun);
  }

  // 4. Delete exams
  total = await deleteCollection(db, `tenants/${tenantId}/exams`, logger, dryRun);
  logger.info(`Deleted ${total} exams`);

  // 5. Delete evaluation settings
  total = await deleteCollection(db, `tenants/${tenantId}/evaluationSettings`, logger, dryRun);
  logger.info(`Deleted ${total} evaluation settings`);

  // 6. Delete students
  total = await deleteCollection(db, `tenants/${tenantId}/students`, logger, dryRun);
  logger.info(`Deleted ${total} students`);

  // 7. Delete teachers
  total = await deleteCollection(db, `tenants/${tenantId}/teachers`, logger, dryRun);
  logger.info(`Deleted ${total} teachers`);

  // 8. Delete classes
  total = await deleteCollection(db, `tenants/${tenantId}/classes`, logger, dryRun);
  logger.info(`Deleted ${total} classes`);

  // 9. Delete memberships for this tenant
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", tenantId)
    .where("joinSource", "==", "migration")
    .get();

  if (!dryRun) {
    const batch = db.batch();
    for (const doc of membershipsSnap.docs) {
      batch.delete(doc.ref);
    }
    if (membershipsSnap.size > 0) await batch.commit();
  }
  logger.info(`Deleted ${membershipsSnap.size} memberships`);

  // 10. Delete tenant
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (tenantDoc.exists && tenantDoc.data()?._migratedFrom === "autograde") {
    if (!dryRun) {
      await db.doc(`tenants/${tenantId}`).delete();
      // Also delete tenantCode index
      const tenantData = tenantDoc.data();
      if (tenantData?.tenantCode) {
        await db.doc(`tenantCodes/${tenantData.tenantCode}`).delete();
      }
    }
    logger.info(`Deleted tenant ${tenantId}`);
  }

  logger.info("AutoGrade rollback complete");
  logger.printSummary();
}
