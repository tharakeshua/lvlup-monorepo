/**
 * WIRE-PRESERVING request schemas + response types for the legacy analytics
 * callables. Ported verbatim from @levelup/shared-types (U3.3, DATA-MODEL-FIX-PLAN
 * §3/§6) so that package can be deleted (U3.5).
 *
 * These deliberately do NOT adopt the @levelup/api-contract v1 request shapes:
 * this package serves the DEPLOYED legacy wire; the v1 successors live in
 * `functions/sdk-v1` + `packages/api-contract` (v1.analytics.getSummary /
 * v1.analytics.generateReport). This file dies with the legacy stack.
 *
 * B8 note: timestamps in RESPONSES from migrated handlers are canonical ISO
 * strings (domain `Timestamp`), never Firestore Timestamp objects.
 */
import { z } from "zod";
import type { Timestamp } from "@levelup/domain";
import type { StudentProgressSummary, ClassProgressSummary } from "./legacy-docs";
/** Firestore document ID pattern (no slashes, non-empty). Ported verbatim. */
export declare const firestoreId: z.ZodString;
/** v1 successor: api-contract analytics `GetSummaryRequestSchema`. */
export declare const GetSummaryRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodOptional<z.ZodString>;
    scope: z.ZodEnum<{
      student: "student";
      class: "class";
      platform: "platform";
      health: "health";
    }>;
    studentId: z.ZodOptional<z.ZodString>;
    classId: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export interface GetSummaryRequest {
  tenantId?: string;
  scope: "student" | "class" | "platform" | "health";
  /** Required when scope = 'student' */
  studentId?: string;
  /** Required when scope = 'class' */
  classId?: string;
}
export interface PlatformSummaryResponse {
  newTenantsThisMonth: number;
  newTenantsLastMonth: number;
  newUsersThisWeek: number;
  newUsersLastWeek: number;
  activeUsersLast7d: number;
  recentActivity: Array<{
    id: string;
    action: string;
    actorEmail: string;
    tenantId?: string;
    metadata: Record<string, unknown>;
    /** B8: ISO over the wire (null when the source doc had no/garbage createdAt). */
    createdAt: Timestamp | null;
  }>;
}
export interface HealthSummaryResponse {
  snapshots: Array<{
    date: string;
    status: string;
  }>;
  errorCount24h: number;
}
export interface GetSummaryResponse {
  scope: "student" | "class" | "platform" | "health";
  studentSummary?: StudentProgressSummary;
  classSummary?: ClassProgressSummary;
  platformSummary?: PlatformSummaryResponse;
  healthSummary?: HealthSummaryResponse;
}
/** v1 successor: api-contract analytics `GenerateReportRequestSchema`. */
export declare const GenerateReportRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    type: z.ZodEnum<{
      class: "class";
      "exam-result": "exam-result";
      progress: "progress";
    }>;
    examId: z.ZodOptional<z.ZodString>;
    studentId: z.ZodOptional<z.ZodString>;
    classId: z.ZodOptional<z.ZodString>;
    academicSessionId: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export interface GenerateReportRequest {
  tenantId: string;
  type: "exam-result" | "progress" | "class";
  /** Required for type: 'exam-result' */
  examId?: string;
  /** Required for type: 'exam-result' and 'progress' */
  studentId?: string;
  /** Required for type: 'class' */
  classId?: string;
  /** Optional filters */
  academicSessionId?: string;
}
export interface GenerateReportResponse {
  pdfUrl: string;
}
