/**
 * Migrate LevelUp items → /tenants/{tId}/spaces/{sId}/items/{itemId}
 *
 * Items are in the global /items collection with courseId reference.
 * They get moved under the tenant's space.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyItem {
  _docId: string;
  courseId: string;
  storyPointId: string;
  sectionId?: string;
  type: string;
  title?: string;
  content?: string;
  difficulty?: string;
  topics?: string[];
  labels?: string[];
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
  analytics?: Record<string, unknown>;
  sect_order_idx?: number;
  orderIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export async function migrateItems(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Migrating LevelUp items for org ${orgId}`);

  // Get all courses belonging to this org to know which items to migrate
  const coursesSnap = await db.collection("courses").where("orgId", "==", orgId).get();
  const courseIds = coursesSnap.docs.map((d) => d.id);
  logger.info(`Found ${courseIds.length} courses to migrate items from`);

  for (const courseId of courseIds) {
    const spaceId = courseId; // 1:1 mapping

    const items = await readAllDocs<LegacyItem>(
      db.collection("items").where("courseId", "==", courseId) as admin.firestore.Query
    );
    logger.info(`Course ${courseId}: ${items.length} items`);

    await processBatch(
      items,
      async (item, batch, db) => {
        const itemId = item._docId;
        const targetPath = `tenants/${tenantId}/spaces/${spaceId}/items/${itemId}`;

        if (await docExists(db, targetPath)) {
          logger.debug(`Item ${itemId} already migrated, skipping`);
          return { action: "skipped", id: itemId };
        }

        const newItem = {
          id: itemId,
          spaceId,
          storyPointId: item.storyPointId,
          tenantId,
          sectionId: item.sectionId || null,
          type: item.type,
          title: item.title || null,
          content: item.content || null,
          difficulty: item.difficulty || null,
          topics: item.topics || [],
          labels: item.labels || [],
          payload: item.payload,
          orderIndex: item.orderIndex ?? item.sect_order_idx ?? 0,
          meta: {
            ...(item.meta || {}),
            migrationSource: {
              type: "levelup_item" as const,
              sourceId: itemId,
              sourceCollection: "items",
            },
          },
          analytics: item.analytics || null,
          rubric: null,
          linkedQuestionId: null,
          createdBy: null,
          createdAt: item.createdAt
            ? admin.firestore.Timestamp.fromMillis(item.createdAt)
            : admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          _migratedFrom: "levelup",
          _migrationSourcePath: `items/${itemId}`,
        };

        if (dryRun) {
          logger.info(`[DRY RUN] Would migrate item: ${itemId} (${item.type})`);
          return { action: "created", id: itemId };
        }

        batch.set(db.doc(targetPath), newItem);
        return { action: "created", id: itemId };
      },
      { dryRun, logger }
    );
  }

  logger.printSummary();
}
