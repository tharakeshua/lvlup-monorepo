/**
 * v1.analytics.dismissInsight — the ONLY client-facing write in this domain.
 * Owner/parent-scoped; sets `dismissedAt`. Idempotent (mark-read-like; on the
 * conservative optimistic allow-list). Invalidates the student's insight list.
 * Plan: §2.6 L90, §4.4.
 */
import { z } from "zod";
import { zObject, zInsightId, zTimestamp } from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";

export const DismissInsightRequestSchema = zObject({
  insightId: zInsightId,
});
export type DismissInsightRequest = z.infer<typeof DismissInsightRequestSchema>;

export const DismissInsightResponseSchema = zObject({
  id: zInsightId,
  dismissedAt: zTimestamp,
});
export type DismissInsightResponse = z.infer<typeof DismissInsightResponseSchema>;

export const dismissInsight = defineCallable({
  name: "v1.analytics.dismissInsight",
  module: "analytics",
  requestSchema: DismissInsightRequestSchema,
  responseSchema: DismissInsightResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["insights"],
});
