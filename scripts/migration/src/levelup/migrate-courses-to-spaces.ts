/**
 * Migrate LevelUp courses → /tenants/{tId}/spaces/{spaceId}
 * Also migrates storyPoints into the space context.
 *
 * Only migrates courses that belong to the given org.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyCourse {
  _docId: string;
  ownerUid: string;
  slug: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  isPublic?: boolean;
  labels?: string[];
  type?: string;
  orgId?: string;
  orgGroupIds?: string[];
  adminUids?: string[];
  defaultEvaluatorAgentId?: string;
  createdAt: number;
  updatedAt: number;
}

interface LegacyStoryPoint {
  _docId: string;
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  difficulty?: string;
  type?: string;
  durationMinutes?: number;
  content?: string;
  sections?: Array<{ id: string; title: string; orderIndex: number }>;
  createdAt: number;
  updatedAt: number;
}

/** Map legacy course type to new SpaceType. */
function mapSpaceType(legacyType?: string): string {
  if (legacyType === "practice_range") return "practice";
  return "learning";
}

export async function migrateCoursesToSpaces(options: {
  orgId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { orgId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = orgId;

  logger.info(`Migrating LevelUp courses → spaces for org ${orgId}`);

  // Get courses belonging to this org
  const courses = await readAllDocs<LegacyCourse>(
    db.collection("courses").where("orgId", "==", orgId) as admin.firestore.Query
  );
  logger.info(`Found ${courses.length} courses`);

  await processBatch(
    courses,
    async (course, batch, db) => {
      const spaceId = course._docId;
      const targetPath = `tenants/${tenantId}/spaces/${spaceId}`;

      if (await docExists(db, targetPath)) {
        logger.debug(`Space ${spaceId} already migrated, skipping`);
        return { action: "skipped", id: spaceId };
      }

      const newSpace = {
        id: spaceId,
        tenantId,
        title: course.title,
        description: course.description || null,
        thumbnailUrl: course.thumbnailUrl || null,
        slug: course.slug,
        type: mapSpaceType(course.type),
        labels: course.labels || [],
        classIds: [],
        teacherIds: course.adminUids || [course.ownerUid],
        accessType: course.isPublic ? "public_store" : "tenant_wide",
        defaultEvaluatorAgentId: course.defaultEvaluatorAgentId || null,
        status: "published" as const,
        stats: {
          totalStoryPoints: 0,
          totalItems: 0,
          totalStudents: 0,
        },
        createdBy: course.ownerUid,
        createdAt: course.createdAt
          ? admin.firestore.Timestamp.fromMillis(course.createdAt)
          : admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "levelup",
        _migrationSourcePath: `courses/${spaceId}`,
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would migrate course → space: ${spaceId} (${course.title})`);
      } else {
        batch.set(db.doc(targetPath), newSpace);
      }

      // Migrate storyPoints for this course
      const storyPoints = await readAllDocs<LegacyStoryPoint>(
        db.collection("storyPoints").where("courseId", "==", spaceId) as admin.firestore.Query
      );

      for (const sp of storyPoints) {
        const spPath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${sp._docId}`;
        if (await docExists(db, spPath)) continue;

        const newSP = {
          id: sp._docId,
          spaceId,
          tenantId,
          title: sp.title,
          description: sp.description || null,
          orderIndex: sp.orderIndex,
          difficulty: sp.difficulty || null,
          type: sp.type || "standard",
          durationMinutes: sp.durationMinutes || null,
          content: sp.content || null,
          sections: sp.sections || [],
          assessmentConfig: null,
          defaultRubric: null,
          estimatedTimeMinutes: sp.durationMinutes || null,
          stats: null,
          createdBy: course.ownerUid,
          createdAt: sp.createdAt
            ? admin.firestore.Timestamp.fromMillis(sp.createdAt)
            : admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          _migratedFrom: "levelup",
        };

        if (dryRun) {
          logger.info(`[DRY RUN] Would migrate storyPoint: ${sp._docId} (${sp.title})`);
        } else {
          batch.set(db.doc(spPath), newSP);
        }
      }

      return { action: "created", id: spaceId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
