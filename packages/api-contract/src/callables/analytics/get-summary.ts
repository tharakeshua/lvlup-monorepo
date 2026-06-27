/**
 * v1.analytics.getSummary — discriminated by `scope`.
 *
 * scope:'student' → { scope, studentSummary }
 * scope:'class'   → { scope, classSummary }   (carries tenantRollup + masteryDistribution, C6)
 * scope:'platform'→ { scope, platformSummary } (super-admin, C29 shaping)
 * scope:'health'  → { scope, healthSummary }   (super-admin)
 *
 * No `tenantId` in the request (claim-derived). `studentId`/`classId` are the only
 * scope selectors. Plan: §2.6, §9 (C6/C29), domains/analytics.md L86.
 */
import { z } from "zod";
import { zObject, zStudentId, zClassId, StudentProgressSummarySchema } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { ClassSummaryViewSchema, PlatformSummarySchema, HealthSummarySchema } from "./_schemas.js";

export const GetSummaryRequestSchema = z.discriminatedUnion("scope", [
  zObject({ scope: z.literal("student"), studentId: zStudentId.optional() }),
  zObject({ scope: z.literal("class"), classId: zClassId.optional() }),
  zObject({ scope: z.literal("platform") }),
  zObject({ scope: z.literal("health") }),
]);
export type GetSummaryRequest = z.infer<typeof GetSummaryRequestSchema>;

export const GetSummaryResponseSchema = z.discriminatedUnion("scope", [
  zObject({ scope: z.literal("student"), studentSummary: StudentProgressSummarySchema }),
  zObject({ scope: z.literal("class"), classSummary: ClassSummaryViewSchema }),
  zObject({ scope: z.literal("platform"), platformSummary: PlatformSummarySchema }),
  zObject({ scope: z.literal("health"), healthSummary: HealthSummarySchema }),
]);
export type GetSummaryResponse = z.infer<typeof GetSummaryResponseSchema>;

export const getSummary = defineCallable({
  name: "v1.analytics.getSummary",
  module: "analytics",
  requestSchema: GetSummaryRequestSchema,
  responseSchema: GetSummaryResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
