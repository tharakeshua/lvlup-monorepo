/**
 * Notification, NotificationPreferences, NotificationBadgeState, Announcement.
 * `recipientUid` canonical (REVIEW D12 — reconciled to the auth-uid name, consistent
 * with authUid-not-uid D3). `title`/`body` are server-rendered. Badge state keeps
 * epoch-ms `createdAt` (RTDB has no Timestamp — the single fenced D4 exception).
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zNotificationId,
  zAnnouncementId,
  zTenantId,
  zUserId,
  zClassId,
} from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import {
  zNotificationType,
  zNotificationEntityType,
  zNotificationRecipientRole,
} from "../../enums/notification.js";
import { zAnnouncementScope, zAnnouncementStatus } from "../../enums/misc.js";

export const NotificationSchema = zObject({
  id: zNotificationId,
  tenantId: zTenantId,
  recipientUid: zUserId,
  recipientRole: zNotificationRecipientRole,
  type: zNotificationType,
  title: z.string().max(200),
  body: z.string().max(1000),
  entityType: zNotificationEntityType.optional(),
  entityId: z.string().optional(),
  actionUrl: z.string().optional(),
  isRead: z.boolean().default(false),
  createdAt: zTimestamp,
  readAt: zTimestamp.nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationPreferencesSchema = zObject({
  id: z.string(),
  tenantId: zTenantId,
  userId: zUserId,
  enabledTypes: z.array(zNotificationType).default([]),
  muteUntil: zTimestamp.nullable(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

/**
 * RTDB badge payload. `latest.createdAt` is epoch-ms by deliberate exception (RTDB
 * has no Timestamp type) — fenced here so the trichotomy never leaks back into
 * Firestore-backed entities.
 */
export const NotificationBadgeStateSchema = zObject({
  unreadCount: z.number().int().min(0),
  latest: zObject({
    id: zNotificationId,
    title: z.string(),
    type: zNotificationType,
    createdAt: z.number().int(),
  }).optional(),
});
export type NotificationBadgeState = z.infer<typeof NotificationBadgeStateSchema>;

export const AnnouncementSchema = zObject({
  id: zAnnouncementId,
  tenantId: zTenantId.nullable(),
  title: z.string().max(200),
  body: z.string().max(5000),
  authorUid: zUserId,
  authorName: z.string(),
  scope: zAnnouncementScope,
  targetRoles: z.array(zNotificationRecipientRole).max(10).optional(),
  targetClassIds: z.array(zClassId).max(100).optional(),
  status: zAnnouncementStatus,
  publishedAt: zTimestamp.nullable(),
  archivedAt: zTimestamp.nullable(),
  expiresAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});
export type Announcement = z.infer<typeof AnnouncementSchema>;
