/**
 * Migrate LevelUp progress → /tenants/{tId}/spaceProgress/{userId}_{spaceId}
 *
 * Combines data from:
 *   - /userStoryPointProgress/{userId}_{storyPointId} (Firestore)
 *   - userCourseProgress/{userId}/{courseId} (RTDB, if accessible)
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyStoryPointProgress {
  _docId: string;
  userId: string;
  courseId: string;
  storyPointId: string;
  status: string;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  items: Record<string, unknown>;
  updatedAt: number;
  completedAt?: number;
}

export async function migrateProgress(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Migrating LevelUp progress for org ${orgId}`);

  // Get all courses belonging to this org
  const coursesSnap = await db.collection("courses").where("orgId", "==", orgId).get();
  const courseIds = coursesSnap.docs.map((d) => d.id);
  logger.info(`Found ${courseIds.length} courses to migrate progress from`);

  for (const courseId of courseIds) {
    const spaceId = courseId;

    // Read story point progress for this course
    const progressDocs = await readAllDocs<LegacyStoryPointProgress>(
      db
        .collection("userStoryPointProgress")
        .where("courseId", "==", courseId) as admin.firestore.Query
    );
    logger.info(`Course ${courseId}: ${progressDocs.length} story point progress records`);

    // Group by userId to build SpaceProgress documents
    const progressByUser = new Map<string, LegacyStoryPointProgress[]>();
    for (const p of progressDocs) {
      if (!progressByUser.has(p.userId)) progressByUser.set(p.userId, []);
      progressByUser.get(p.userId)!.push(p);
    }

    const userProgressEntries = Array.from(progressByUser.entries()).map(([userId, entries]) => ({
      userId,
      entries,
    }));

    await processBatch(
      userProgressEntries,
      async (item, batch, db) => {
        const { userId, entries } = item;
        const progressId = `${userId}_${spaceId}`;
        const targetPath = `tenants/${tenantId}/spaceProgress/${progressId}`;

        if (await docExists(db, targetPath)) {
          logger.debug(`SpaceProgress ${progressId} already migrated, skipping`);
          return { action: "skipped", id: progressId };
        }

        // Aggregate story point progress
        let totalPointsEarned = 0;
        let totalPointsMax = 0;
        const storyPoints: Record<string, unknown> = {};
        const allItems: Record<string, unknown> = {};
        let overallStatus = "not_started";
        let latestUpdate = 0;

        for (const entry of entries) {
          totalPointsEarned += entry.pointsEarned;
          totalPointsMax += entry.totalPoints;

          storyPoints[entry.storyPointId] = {
            storyPointId: entry.storyPointId,
            status: entry.status,
            pointsEarned: entry.pointsEarned,
            totalPoints: entry.totalPoints,
            percentage: entry.percentage,
            completedAt: entry.completedAt || null,
          };

          // Merge items
          if (entry.items) {
            for (const [itemId, itemData] of Object.entries(entry.items)) {
              allItems[itemId] = itemData;
            }
          }

          if (entry.updatedAt > latestUpdate) latestUpdate = entry.updatedAt;
          if (entry.status === "completed" || entry.status === "in_progress") {
            if (overallStatus === "not_started") overallStatus = entry.status;
            if (entry.status === "in_progress" && overallStatus === "completed") {
              overallStatus = "in_progress";
            }
          }
        }

        // Check if all story points are completed
        const allCompleted = entries.every((e) => e.status === "completed");
        if (allCompleted && entries.length > 0) overallStatus = "completed";

        const percentage = totalPointsMax > 0 ? totalPointsEarned / totalPointsMax : 0;

        const spaceProgress = {
          id: progressId,
          userId,
          tenantId,
          spaceId,
          status: overallStatus,
          pointsEarned: totalPointsEarned,
          totalPoints: totalPointsMax,
          percentage,
          storyPoints,
          items: allItems,
          updatedAt: latestUpdate
            ? admin.firestore.Timestamp.fromMillis(latestUpdate)
            : admin.firestore.Timestamp.now(),
          _migratedFrom: "levelup",
        };

        if (dryRun) {
          logger.info(
            `[DRY RUN] Would migrate space progress: ${progressId} (${entries.length} story points, ${percentage.toFixed(1)}%)`
          );
          return { action: "created", id: progressId };
        }

        batch.set(db.doc(targetPath), spaceProgress);
        return { action: "created", id: progressId };
      },
      { dryRun, logger }
    );
  }

  logger.printSummary();
}
