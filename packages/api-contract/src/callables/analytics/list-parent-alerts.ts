/**
 * v1.analytics.listParentAlerts — first-class parent alert feed (C18, §9.2).
 * Reads `ctx.studentIds` (batched, server-assembled); no body studentId. Paginated.
 */
import { z } from "zod";
import { defineCallable } from "../../callable-def.js";
import { PageRequest, pageResponse } from "../../pagination.js";
import { ParentAlertSchema } from "./_schemas.js";

export const ListParentAlertsRequestSchema = PageRequest;
export type ListParentAlertsRequest = z.infer<typeof ListParentAlertsRequestSchema>;

export const ListParentAlertsResponseSchema = pageResponse(ParentAlertSchema);
export type ListParentAlertsResponse = z.infer<typeof ListParentAlertsResponseSchema>;

export const listParentAlerts = defineCallable({
  name: "v1.analytics.listParentAlerts",
  module: "analytics",
  requestSchema: ListParentAlertsRequestSchema,
  responseSchema: ListParentAlertsResponseSchema,
  authMode: "authed",
  rateTier: "read",
});
