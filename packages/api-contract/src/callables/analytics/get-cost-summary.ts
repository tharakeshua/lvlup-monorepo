/**
 * v1.analytics.getCostSummary — admin/super-admin AI cost roll-ups. Replaces direct
 * `costSummaries` read (D13); normalized `costSummaries/{daily|monthly}` path (D14).
 * Returns a heterogeneous list (daily | monthly summaries). Plan: §2.6 L94.
 */
import { z } from "zod";
import {
  zObject,
  zCostSummaryGranularity,
  zIsoDate,
  DailyCostSummarySchema,
  MonthlyCostSummarySchema,
} from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { TimeRangeSchema } from "./_schemas.js";

export const GetCostSummaryRequestSchema = zObject({
  granularity: zCostSummaryGranularity,
  // exact-day (daily) selector
  date: zIsoDate.optional(),
  // exact-month (monthly) selector, YYYY-MM
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  range: TimeRangeSchema.optional(),
});
export type GetCostSummaryRequest = z.infer<typeof GetCostSummaryRequestSchema>;

export const GetCostSummaryResponseSchema = zObject({
  summaries: z.array(z.union([DailyCostSummarySchema, MonthlyCostSummarySchema])),
});
export type GetCostSummaryResponse = z.infer<typeof GetCostSummaryResponseSchema>;

export const getCostSummary = defineCallable({
  name: "v1.analytics.getCostSummary",
  module: "analytics",
  requestSchema: GetCostSummaryRequestSchema,
  responseSchema: GetCostSummaryResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
