import { z } from "zod";

export const SaveAnnouncementRequestSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().optional(),
  data: z.object({
    title: z.string().max(200).optional(),
    body: z.string().max(5000).optional(),
    scope: z.enum(["platform", "tenant"]).optional(),
    targetRoles: z.array(z.string()).max(10).optional(),
    targetClassIds: z.array(z.string()).max(100).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    expiresAt: z.string().optional(),
  }),
  delete: z.boolean().optional(),
});

export const ListAnnouncementsRequestSchema = z.object({
  tenantId: z.string().optional(),
  scope: z.enum(["platform", "tenant"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  limit: z.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
});
