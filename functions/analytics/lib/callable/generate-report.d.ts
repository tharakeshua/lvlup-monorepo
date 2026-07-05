/**
 * generateReport — Consolidated callable function.
 *
 * Replaces: generateExamResultPdf, generateProgressReportPdf, generateClassReportPdf
 *
 * type: 'exam-result' → exam result PDF (individual or class summary)
 * type: 'progress'    → student progress report PDF
 * type: 'class'       → class report card PDF
 */
import type { GenerateReportResponse } from "../contracts/wire";
export declare const generateReport: import("firebase-functions/https").CallableFunction<
  any,
  Promise<GenerateReportResponse>,
  unknown
>;
