/**
 * saveExam — Consolidated endpoint replacing:
 *   createExam, updateExam, publishExam, releaseExamResults, linkExamToSpace
 *
 * - No `id` in request → create new exam
 * - `id` present → update existing exam (including status transitions)
 * - Status transitions validated server-side using ExamStatus from shared-types
 */
import type { SaveResponse } from "@levelup/shared-types";
export declare const saveExam: import("firebase-functions/https").CallableFunction<
  any,
  Promise<SaveResponse>,
  unknown
>;
