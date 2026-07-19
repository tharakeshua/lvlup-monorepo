/**
 * Migrate AutoGrade submissions:
 *   /clients/{cId}/submissions/{subId} → /tenants/{tId}/submissions/{subId}
 * Also migrates subcollection: /submissions/{subId}/questionSubmissions/{qId}
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacySubmission {
  _docId: string;
  id: string;
  clientId: string;
  examId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  answerSheets: {
    images: string[];
    uploadedAt: admin.firestore.Timestamp;
    uploadedBy: string;
  };
  scoutingResult?: {
    routingMap: Record<string, number[]>;
    completedAt: admin.firestore.Timestamp;
  };
  summary: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string;
    status: string;
    questionsGraded?: number;
    totalQuestions?: number;
    completedAt?: admin.firestore.Timestamp;
  };
  createdAt: admin.firestore.Timestamp;
}

/** Map legacy submission status to new pipeline status. */
function mapPipelineStatus(legacyStatus: string): string {
  const mapping: Record<string, string> = {
    pending: "uploaded",
    scouting: "scouting",
    grading: "grading",
    completed: "grading_complete",
    failed: "failed",
  };
  return mapping[legacyStatus] || "uploaded";
}

export async function migrateSubmissions(options: {
  clientId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = clientId;

  logger.info(`Migrating submissions for client ${clientId}`);

  const submissions = await readAllDocs<LegacySubmission>(
    db.collection(`clients/${clientId}/submissions`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${submissions.length} submissions`);

  await processBatch(
    submissions,
    async (sub, batch, db) => {
      const subId = sub._docId;
      const targetPath = `tenants/${tenantId}/submissions/${subId}`;

      if (await docExists(db, targetPath)) {
        logger.debug(`Submission ${subId} already migrated, skipping`);
        return { action: "skipped", id: subId };
      }

      const newSubmission = {
        id: subId,
        tenantId,
        examId: sub.examId,
        studentId: sub.studentId,
        studentName: sub.studentName,
        rollNumber: sub.rollNumber,
        classId: sub.classId,
        answerSheets: {
          images: sub.answerSheets.images,
          uploadedAt: sub.answerSheets.uploadedAt,
          uploadedBy: sub.answerSheets.uploadedBy,
          uploadSource: "web" as const,
        },
        scoutingResult: sub.scoutingResult
          ? {
              routingMap: sub.scoutingResult.routingMap,
              confidence: {},
              completedAt: sub.scoutingResult.completedAt,
            }
          : null,
        summary: {
          totalScore: sub.summary.totalScore,
          maxScore: sub.summary.maxScore,
          percentage: sub.summary.percentage,
          grade: sub.summary.grade,
          questionsGraded: sub.summary.questionsGraded || 0,
          totalQuestions: sub.summary.totalQuestions || 0,
          completedAt: sub.summary.completedAt || null,
        },
        pipelineStatus: mapPipelineStatus(sub.summary.status),
        pipelineError: null,
        retryCount: 0,
        resultsReleased: sub.summary.status === "completed",
        resultsReleasedAt:
          sub.summary.status === "completed" ? sub.summary.completedAt || null : null,
        resultsReleasedBy: null,
        createdAt: sub.createdAt || admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "autograde",
        _migrationSourcePath: `clients/${clientId}/submissions/${subId}`,
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would migrate submission: ${subId}`);
      } else {
        batch.set(db.doc(targetPath), newSubmission);
      }

      // Migrate questionSubmissions subcollection
      const qSubs = await readAllDocs<Record<string, unknown>>(
        db.collection(
          `clients/${clientId}/submissions/${subId}/questionSubmissions`
        ) as admin.firestore.CollectionReference
      );

      for (const qs of qSubs) {
        const qsPath = `tenants/${tenantId}/submissions/${subId}/questionSubmissions/${qs._docId}`;
        if (await docExists(db, qsPath)) continue;

        if (dryRun) {
          logger.info(`[DRY RUN] Would migrate questionSubmission: ${qs._docId}`);
        } else {
          const { _docId, ...data } = qs;
          batch.set(db.doc(qsPath), {
            ...data,
            _migratedFrom: "autograde",
          });
        }
      }

      return { action: "created", id: subId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
