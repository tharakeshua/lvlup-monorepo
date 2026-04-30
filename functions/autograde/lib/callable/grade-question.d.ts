/**
 * gradeQuestion — Consolidated endpoint replacing:
 *   manualGradeQuestion, retryFailedQuestions
 *
 * - mode: 'manual' → grade a single question with manual override
 * - mode: 'retry'  → retry failed AI grading for a submission
 * - mode: 'ai'     → run AI grading synchronously on a single question
 */
import type { GradeQuestionResponse } from "@levelup/shared-types";
export declare const gradeQuestion: import("firebase-functions/https").CallableFunction<
  any,
  Promise<GradeQuestionResponse>,
  unknown
>;
