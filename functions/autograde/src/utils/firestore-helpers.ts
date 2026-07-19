import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import {
  Exam,
  ExamQuestion,
  Submission,
  QuestionSubmission,
  EvaluationFeedbackRubric,
} from "../types";
import {
  ExamSchema,
  ExamQuestionSchema,
  SubmissionSchema,
  QuestionSubmissionSchema,
  EvaluationSettingsSchema,
} from "@levelup/shared-types";

const db = () => admin.firestore();

export async function getExam(tenantId: string, examId: string): Promise<Exam | null> {
  const doc = await db().doc(`tenants/${tenantId}/exams/${examId}`).get();
  if (!doc.exists) return null;
  const result = ExamSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    logger.error("Invalid Exam document", { docId: doc.id, errors: result.error.flatten() });
    return null;
  }
  return result.data as unknown as Exam;
}

export async function getExamQuestions(tenantId: string, examId: string): Promise<ExamQuestion[]> {
  const snap = await db()
    .collection(`tenants/${tenantId}/exams/${examId}/questions`)
    .orderBy("order", "asc")
    .get();
  return snap.docs.map((d) => {
    const result = ExamQuestionSchema.safeParse({ id: d.id, ...d.data() });
    if (!result.success) {
      logger.error("Invalid ExamQuestion document", {
        docId: d.id,
        errors: result.error.flatten(),
      });
      throw new Error("Data integrity error");
    }
    return result.data as unknown as ExamQuestion;
  });
}

export async function getSubmission(
  tenantId: string,
  submissionId: string
): Promise<Submission | null> {
  const doc = await db().doc(`tenants/${tenantId}/submissions/${submissionId}`).get();
  if (!doc.exists) return null;
  const result = SubmissionSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    logger.error("Invalid Submission document", { docId: doc.id, errors: result.error.flatten() });
    return null;
  }
  return result.data as unknown as Submission;
}

export async function getQuestionSubmissions(
  tenantId: string,
  submissionId: string
): Promise<QuestionSubmission[]> {
  const snap = await db()
    .collection(`tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`)
    .get();
  return snap.docs.map((d) => {
    const result = QuestionSubmissionSchema.safeParse({ id: d.id, ...d.data() });
    if (!result.success) {
      logger.error("Invalid QuestionSubmission document", {
        docId: d.id,
        errors: result.error.flatten(),
      });
      throw new Error("Data integrity error");
    }
    return result.data as unknown as QuestionSubmission;
  });
}

export async function getEvaluationSettings(
  tenantId: string,
  settingsId: string
): Promise<EvaluationFeedbackRubric | null> {
  const doc = await db().doc(`tenants/${tenantId}/evaluationSettings/${settingsId}`).get();
  if (!doc.exists) return null;
  const result = EvaluationSettingsSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    logger.error("Invalid EvaluationSettings document", {
      docId: doc.id,
      errors: result.error.flatten(),
    });
    return null;
  }
  return result.data as unknown as EvaluationFeedbackRubric;
}
