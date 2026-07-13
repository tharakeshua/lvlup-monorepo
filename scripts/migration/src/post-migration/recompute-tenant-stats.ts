/**
 * Post-migration: Recompute tenant stats from actual document counts.
 *
 * After migration, the stats counters on tenant documents are initialized to 0.
 * This script counts actual documents and updates the stats atomically.
 *
 * Usage:
 *   npx tsx src/run-migration.ts --post-migration stats --client-id <tenantId>
 *   npx tsx src/run-migration.ts --post-migration stats   # all tenants
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { countDocs } from "../utils/verification.js";
import { readAllDocs } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

export async function recomputeTenantStats(options: {
  tenantId?: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { tenantId, dryRun, logger } = options;
  const db = getFirestore();

  logger.info("Recomputing tenant stats");

  // Get tenants to process
  let tenantsSnap: admin.firestore.QuerySnapshot;
  if (tenantId) {
    const doc = await db.doc(`tenants/${tenantId}`).get();
    if (!doc.exists) {
      logger.error(`Tenant ${tenantId} does not exist`);
      return;
    }
    tenantsSnap = await db
      .collection("tenants")
      .where(admin.firestore.FieldPath.documentId(), "==", tenantId)
      .get();
  } else {
    tenantsSnap = await db.collection("tenants").get();
  }

  logger.info(`Processing ${tenantsSnap.size} tenant(s)`);

  for (const tenantDoc of tenantsSnap.docs) {
    const tId = tenantDoc.id;
    logger.info(`Computing stats for tenant ${tId}`);

    const [totalStudents, totalTeachers, totalClasses, totalSpaces, totalExams] = await Promise.all(
      [
        countDocs(db.collection(`tenants/${tId}/students`)),
        countDocs(db.collection(`tenants/${tId}/teachers`)),
        countDocs(db.collection(`tenants/${tId}/classes`)),
        countDocs(db.collection(`tenants/${tId}/spaces`)),
        countDocs(db.collection(`tenants/${tId}/exams`)),
      ]
    );

    // Count active students in last 30 days (from memberships)
    const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const activeMemberships = await countDocs(
      db
        .collection("userMemberships")
        .where("tenantId", "==", tId)
        .where("role", "==", "student")
        .where("lastActive", ">=", thirtyDaysAgo)
    );

    const stats = {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSpaces,
      totalExams,
      activeStudentsLast30Days: activeMemberships,
    };

    logger.info(`Tenant ${tId} stats: ${JSON.stringify(stats)}`);

    if (dryRun) {
      logger.info(`[DRY RUN] Would update tenant ${tId} stats`);
      continue;
    }

    await db.doc(`tenants/${tId}`).update({
      stats,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    logger.info(`Updated tenant ${tId} stats`);
  }

  // Also recompute space stats
  for (const tenantDoc of tenantsSnap.docs) {
    const tId = tenantDoc.id;
    const spacesSnap = await db.collection(`tenants/${tId}/spaces`).get();

    for (const spaceDoc of spacesSnap.docs) {
      const sId = spaceDoc.id;
      const [totalStoryPoints, totalItems] = await Promise.all([
        countDocs(db.collection(`tenants/${tId}/spaces/${sId}/storyPoints`)),
        countDocs(db.collection(`tenants/${tId}/spaces/${sId}/items`)),
      ]);

      // Count students with space progress
      const progressCount = await countDocs(
        db.collection(`tenants/${tId}/spaceProgress`).where("spaceId", "==", sId)
      );

      const spaceStats = {
        totalStoryPoints,
        totalItems,
        totalStudents: progressCount,
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would update space ${sId} stats: ${JSON.stringify(spaceStats)}`);
        continue;
      }

      await db.doc(`tenants/${tId}/spaces/${sId}`).update({
        stats: spaceStats,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  }

  logger.printSummary();
}
