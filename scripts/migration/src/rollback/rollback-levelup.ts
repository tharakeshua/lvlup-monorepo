/**
 * Rollback LevelUp migration: delete migrated tenant data.
 *
 * Only deletes documents that have the _migratedFrom: 'levelup' marker.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { MigrationLogger } from "../utils/logger.js";

const BATCH_SIZE = 500;

async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  logger: MigrationLogger,
  dryRun: boolean
): Promise<number> {
  let deleted = 0;
  const query = db.collection(collectionPath).where("_migratedFrom", "==", "levelup");

  while (true) {
    const snapshot = await query.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    if (dryRun) {
      logger.info(`[DRY RUN] Would delete ${snapshot.size} docs from ${collectionPath}`);
      deleted += snapshot.size;
      break;
    }

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;
    logger.info(`Deleted ${snapshot.size} docs from ${collectionPath} (total: ${deleted})`);

    await new Promise((r) => setTimeout(r, 1000));
  }

  return deleted;
}

export async function rollbackLevelUp(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Rolling back LevelUp migration for org ${orgId}`);
  if (dryRun) logger.info("[DRY RUN MODE]");

  // 1. Delete chat sessions
  let total = await deleteCollection(db, `tenants/${tenantId}/chatSessions`, logger, dryRun);
  logger.info(`Deleted ${total} chat sessions`);

  // 2. Delete space progress
  total = await deleteCollection(db, `tenants/${tenantId}/spaceProgress`, logger, dryRun);
  logger.info(`Deleted ${total} space progress records`);

  // 3. Delete items, storyPoints, and agents from each space (subcollections)
  const spacesSnap = await db
    .collection(`tenants/${tenantId}/spaces`)
    .where("_migratedFrom", "==", "levelup")
    .get();
  for (const spaceDoc of spacesSnap.docs) {
    await deleteCollection(db, `tenants/${tenantId}/spaces/${spaceDoc.id}/items`, logger, dryRun);
    await deleteCollection(
      db,
      `tenants/${tenantId}/spaces/${spaceDoc.id}/storyPoints`,
      logger,
      dryRun
    );
    await deleteCollection(db, `tenants/${tenantId}/spaces/${spaceDoc.id}/agents`, logger, dryRun);
  }

  // 4. Delete spaces
  total = await deleteCollection(db, `tenants/${tenantId}/spaces`, logger, dryRun);
  logger.info(`Deleted ${total} spaces`);

  // 5. Delete memberships for this tenant that came from migration
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", tenantId)
    .where("joinSource", "==", "migration")
    .get();

  if (!dryRun && membershipsSnap.size > 0) {
    const batch = db.batch();
    for (const doc of membershipsSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
  logger.info(`Deleted ${membershipsSnap.size} memberships`);

  // 6. Delete tenant
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (tenantDoc.exists && tenantDoc.data()?._migratedFrom === "levelup") {
    if (!dryRun) {
      await db.doc(`tenants/${tenantId}`).delete();
      const tenantData = tenantDoc.data();
      if (tenantData?.tenantCode) {
        await db.doc(`tenantCodes/${tenantData.tenantCode}`).delete();
      }
    }
    logger.info(`Deleted tenant ${tenantId}`);
  }

  // 6. Remove consumerProfile from consumer users that were migrated
  // (This is optional — consumer profiles don't harm anything)

  logger.info("LevelUp rollback complete");
  logger.printSummary();
}
