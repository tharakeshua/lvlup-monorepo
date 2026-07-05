/**
 * getSummary — Consolidated callable function.
 *
 * Replaces: getStudentSummary, getClassSummary
 * Extended with platform & health scopes for super-admin.
 *
 * scope: 'student'  → returns pre-computed student progress summary
 * scope: 'class'    → returns pre-computed class progress summary
 * scope: 'platform' → returns platform-wide metrics (superAdmin only)
 * scope: 'health'   → returns health snapshots & error counts (superAdmin only)
 */
import type { GetSummaryResponse } from "../contracts/wire";
export declare const getSummary: import("firebase-functions/https").CallableFunction<
  any,
  Promise<GetSummaryResponse>,
  unknown
>;
