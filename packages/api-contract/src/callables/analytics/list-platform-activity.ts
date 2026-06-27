/**
 * v1.analytics.listPlatformActivity — super-admin audit/activity feed (C25, §9.3).
 * Reads the top-level `/platformActivityLog`. Optional `action` filter +
 * `tenantOverride` (super-admin cross-tenant; requires allowsTenantOverride). Paginated.
 */
import { z } from "zod";
import {
  zObject,
  zTenantId,
  zPlatformActivityAction,
  PlatformActivityLogSchema,
} from "@levelup/domain";
import { defineCallable } from "../../callable-def.js";
import { PageRequest, pageResponse } from "../../pagination.js";

export const ListPlatformActivityRequestSchema = zObject({
  action: zPlatformActivityAction.optional(),
  tenantOverride: zTenantId.optional(),
  ...PageRequest.shape,
});
export type ListPlatformActivityRequest = z.infer<typeof ListPlatformActivityRequestSchema>;

export const ListPlatformActivityResponseSchema = pageResponse(PlatformActivityLogSchema);
export type ListPlatformActivityResponse = z.infer<typeof ListPlatformActivityResponseSchema>;

export const listPlatformActivity = defineCallable({
  name: "v1.analytics.listPlatformActivity",
  module: "analytics",
  requestSchema: ListPlatformActivityRequestSchema,
  responseSchema: ListPlatformActivityResponseSchema,
  authMode: "authed",
  rateTier: "read",
  allowsTenantOverride: true,
});
