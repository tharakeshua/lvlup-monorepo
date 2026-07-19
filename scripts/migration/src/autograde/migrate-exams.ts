/**
 * Migrate AutoGrade exams: /clients/{cId}/exams/{examId} → /tenants/{tId}/exams/{examId}
 * Also migrates subcollection: /exams/{eId}/questions/{qId}
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyExam {
  _docId: string;
  id: string;
  clientId: string;
  classIds: string[];
  title: string;
  subject: string;
  topics: string[];
  examDate: admin.firestore.Timestamp;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  createdAt: admin.firestore.Timestamp;
  status: string;
  questionPaper?: {
    images: string[];
    extractedAt: admin.firestore.Timestamp;
    questionCount: number;
  };
  gradingConfig: {
    autoGrade: boolean;
    allowRubricEdit: boolean;
    customRubrics?: Record<string, unknown>;
  };
}

interface LegacyQuestion {
  _docId: string;
  id: string;
  examId: string;
  text: string;
  maxMarks: number;
  order: number;
  rubric: { criteria: Array<{ description: string; marks: number }> };
  createdAt: admin.firestore.Timestamp;
}

/** Map old exam status to new ExamStatus. */
function mapExamStatus(old: string): string {
  const mapping: Record<string, string> = {
    draft: "draft",
    question_paper_uploaded: "question_paper_uploaded",
    in_progress: "grading",
    completed: "completed",
  };
  return mapping[old] || "draft";
}

export async function migrateExams(options: {
  clientId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = clientId;

  logger.info(`Migrating exams for client ${clientId}`);

  const exams = await readAllDocs<LegacyExam>(
    db.collection(`clients/${clientId}/exams`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${exams.length} exams`);

  await processBatch(
    exams,
    async (exam, batch, db) => {
      const examId = exam._docId;
      const targetPath = `tenants/${tenantId}/exams/${examId}`;

      if (await docExists(db, targetPath)) {
        logger.debug(`Exam ${examId} already migrated, skipping`);
        return { action: "skipped", id: examId };
      }

      const newExam = {
        id: examId,
        tenantId,
        title: exam.title,
        subject: exam.subject || "",
        topics: exam.topics || [],
        classIds: exam.classIds || [],
        sectionIds: [],
        examDate: exam.examDate,
        duration: exam.duration,
        academicSessionId: null,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        questionPaper: exam.questionPaper
          ? {
              images: exam.questionPaper.images,
              extractedAt: exam.questionPaper.extractedAt,
              questionCount: exam.questionPaper.questionCount,
              examType: "standard",
            }
          : null,
        gradingConfig: {
          autoGrade: exam.gradingConfig?.autoGrade ?? true,
          allowRubricEdit: exam.gradingConfig?.allowRubricEdit ?? true,
          evaluationSettingsId: "default",
          allowManualOverride: true,
          requireOverrideReason: false,
          releaseResultsAutomatically: false,
        },
        linkedSpaceId: null,
        linkedSpaceTitle: null,
        linkedStoryPointId: null,
        status: mapExamStatus(exam.status),
        evaluationSettingsId: "default",
        stats: null,
        createdBy: "", // Will need to be populated from client admin
        createdAt: exam.createdAt || admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "autograde",
        _migrationSourcePath: `clients/${clientId}/exams/${examId}`,
      };

      if (dryRun) {
        logger.info(`[DRY RUN] Would migrate exam: ${examId} (${exam.title})`);
      } else {
        batch.set(db.doc(targetPath), newExam);
      }

      // Migrate questions subcollection
      const questions = await readAllDocs<LegacyQuestion>(
        db.collection(
          `clients/${clientId}/exams/${examId}/questions`
        ) as admin.firestore.CollectionReference
      );

      for (const q of questions) {
        const qPath = `tenants/${tenantId}/exams/${examId}/questions/${q._docId}`;
        if (await docExists(db, qPath)) continue;

        const newQuestion = {
          id: q._docId,
          examId,
          text: q.text,
          imageUrls: [],
          maxMarks: q.maxMarks,
          order: q.order,
          rubric: q.rubric,
          questionType: "standard" as const,
          subQuestions: [],
          linkedItemId: null,
          extractedBy: null,
          extractedAt: null,
          createdAt: q.createdAt || admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          _migratedFrom: "autograde",
        };

        if (dryRun) {
          logger.info(`[DRY RUN] Would migrate question: ${q._docId}`);
        } else {
          batch.set(db.doc(qPath), newQuestion);
        }
      }

      return { action: "created", id: examId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
