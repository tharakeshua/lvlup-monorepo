/**
 * Announcements + notifications + preferences + device tokens (identity).
 *
 * The `manageNotifications` facade is DELETED (MERGE-NOTIF-FACADE) — the split
 * callables are canonical: `listNotifications`, `getNotificationBadge`,
 * `markNotificationRead`, `getNotificationPreferences`, `saveNotificationPreferences`,
 * + `saveAnnouncement`/`listAnnouncements`/`markAnnouncementRead`/`estimateAudience`.
 * `markNotificationRead`/`markAnnouncementRead` are the ✅ conservative-optimistic
 * surfaces (flip-a-flag, rollback on error) — therefore NOT `authoritySensitive`.
 * Schemas are `.strict()`. NO request declares `tenantId`.
 */
import { z } from "zod";
import {
  NotificationSchema,
  NotificationPreferencesSchema,
  NotificationBadgeStateSchema,
  zAnnouncementId,
  zNotificationId,
  zClassId,
  zUserId,
  zTenantId,
  zAnnouncementScope,
  zAnnouncementStatus,
  zNotificationType,
  zNotificationRecipientRole,
} from "@levelup/domain";
import {
  defineCallable,
  pageResponse,
  withPaging,
  PageRequest,
  SaveResponseSchema,
  type CallableDef,
} from "./_shared.js";

// ── saveAnnouncement ──────────────────────────────────────────────────────────
export const SaveAnnouncementRequestSchema = z
  .object({
    id: zAnnouncementId.optional(),
    // platform scope is super-admin; tenant scope is admin. `tenantOverride` is
    // the super-admin cross-tenant field (never a body `tenantId`).
    tenantOverride: zTenantId.optional(),
    data: z
      .object({
        scope: zAnnouncementScope.optional(),
        title: z.string().max(200).optional(),
        body: z.string().max(5000).optional(),
        targetRoles: z.array(zNotificationRecipientRole).max(10).optional(),
        targetClassIds: z.array(zClassId).max(100).optional(),
        status: zAnnouncementStatus.optional(),
        expiresAt: z.string().optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveAnnouncementRequest = z.infer<typeof SaveAnnouncementRequestSchema>;

export const saveAnnouncement = defineCallable({
  name: "v1.identity.saveAnnouncement",
  module: "identity",
  requestSchema: SaveAnnouncementRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["announcements"],
  // publish lifecycle transition (assertTransition(announcement)) — never optimistic.
  authoritySensitive: true,
});

// ── listAnnouncements ─────────────────────────────────────────────────────────
/** Slim announcement list item (adds caller-relative `isReadByMe`). */
export const AnnouncementListItemSchema = z
  .object({
    id: zAnnouncementId,
    title: z.string(),
    body: z.string(),
    scope: zAnnouncementScope,
    status: zAnnouncementStatus,
    authorName: z.string(),
    publishedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    isReadByMe: z.boolean(),
  })
  .strict();

export const ListAnnouncementsRequestSchema = withPaging(
  z.object({
    scope: zAnnouncementScope.optional(),
    status: zAnnouncementStatus.optional(),
  })
);
export type ListAnnouncementsRequest = z.infer<typeof ListAnnouncementsRequestSchema>;

export const listAnnouncements = defineCallable({
  name: "v1.identity.listAnnouncements",
  module: "identity",
  requestSchema: ListAnnouncementsRequestSchema,
  responseSchema: pageResponse(AnnouncementListItemSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── markAnnouncementRead (✅ optimistic) ──────────────────────────────────────
export const MarkAnnouncementReadRequestSchema = z
  .object({ announcementId: zAnnouncementId })
  .strict();
export type MarkAnnouncementReadRequest = z.infer<typeof MarkAnnouncementReadRequestSchema>;

export const MarkAnnouncementReadResponseSchema = z
  .object({ isReadByMe: z.literal(true) })
  .strict();

export const markAnnouncementRead = defineCallable({
  name: "v1.identity.markAnnouncementRead",
  module: "identity",
  requestSchema: MarkAnnouncementReadRequestSchema,
  responseSchema: MarkAnnouncementReadResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:announcementId",
  invalidates: ["announcements"],
});

// ── estimateAudience (C8) ─────────────────────────────────────────────────────
export const EstimateAudienceRequestSchema = z
  .object({
    targetRoles: z.array(zNotificationRecipientRole).max(10).optional(),
    targetClassIds: z.array(zClassId).max(100).optional(),
  })
  .strict();
export type EstimateAudienceRequest = z.infer<typeof EstimateAudienceRequestSchema>;

export const EstimateAudienceResponseSchema = z
  .object({ recipientCount: z.number().int() })
  .strict();

export const estimateAudience = defineCallable({
  name: "v1.identity.estimateAudience",
  module: "identity",
  requestSchema: EstimateAudienceRequestSchema,
  responseSchema: EstimateAudienceResponseSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── listNotifications ─────────────────────────────────────────────────────────
export const ListNotificationsRequestSchema = PageRequest;
export type ListNotificationsRequest = z.infer<typeof ListNotificationsRequestSchema>;

export const listNotifications = defineCallable({
  name: "v1.identity.listNotifications",
  module: "identity",
  requestSchema: ListNotificationsRequestSchema,
  responseSchema: pageResponse(NotificationSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── getNotificationBadge ──────────────────────────────────────────────────────
export const GetNotificationBadgeRequestSchema = z.object({}).strict();
export type GetNotificationBadgeRequest = z.infer<typeof GetNotificationBadgeRequestSchema>;

export const getNotificationBadge = defineCallable({
  name: "v1.identity.getNotificationBadge",
  module: "identity",
  requestSchema: GetNotificationBadgeRequestSchema,
  responseSchema: NotificationBadgeStateSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── markNotificationRead (✅ optimistic; one|all) ─────────────────────────────
export const MarkNotificationReadRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("one"), notificationId: zNotificationId }).strict(),
  z.object({ mode: z.literal("all") }).strict(),
]);
export type MarkNotificationReadRequest = z.infer<typeof MarkNotificationReadRequestSchema>;

export const MarkNotificationReadResponseSchema = z
  .object({ unreadCount: z.number().int().min(0) })
  .strict();

export const markNotificationRead = defineCallable({
  name: "v1.identity.markNotificationRead",
  module: "identity",
  requestSchema: MarkNotificationReadRequestSchema,
  responseSchema: MarkNotificationReadResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["notifications", "notificationBadge"],
});

// ── getNotificationPreferences (C2) ───────────────────────────────────────────
export const GetNotificationPreferencesRequestSchema = z.object({}).strict();
export type GetNotificationPreferencesRequest = z.infer<
  typeof GetNotificationPreferencesRequestSchema
>;

export const getNotificationPreferences = defineCallable({
  name: "v1.identity.getNotificationPreferences",
  module: "identity",
  requestSchema: GetNotificationPreferencesRequestSchema,
  responseSchema: NotificationPreferencesSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── saveNotificationPreferences (C2 — owner-scoped, idem) ─────────────────────
export const SaveNotificationPreferencesRequestSchema = z
  .object({
    enabledTypes: z.array(zNotificationType).optional(),
    muteUntil: z.string().nullable().optional(),
  })
  .strict();
export type SaveNotificationPreferencesRequest = z.infer<
  typeof SaveNotificationPreferencesRequestSchema
>;

export const saveNotificationPreferences = defineCallable({
  name: "v1.identity.saveNotificationPreferences",
  module: "identity",
  requestSchema: SaveNotificationPreferencesRequestSchema,
  responseSchema: NotificationPreferencesSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  invalidates: ["notificationPreferences"],
});

// ── registerDeviceToken / unregisterDeviceToken (C4) ──────────────────────────
export const RegisterDeviceTokenRequestSchema = z
  .object({
    token: z.string(),
    platform: z.enum(["ios", "android", "web"]),
    appKey: z.string(),
  })
  .strict();
export type RegisterDeviceTokenRequest = z.infer<typeof RegisterDeviceTokenRequestSchema>;

export const DeviceTokenAckSchema = z.object({ ok: z.literal(true) }).strict();

export const registerDeviceToken = defineCallable({
  name: "v1.identity.registerDeviceToken",
  module: "identity",
  requestSchema: RegisterDeviceTokenRequestSchema,
  responseSchema: DeviceTokenAckSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:token",
  invalidates: ["device"],
});

export const UnregisterDeviceTokenRequestSchema = z.object({ token: z.string() }).strict();
export type UnregisterDeviceTokenRequest = z.infer<typeof UnregisterDeviceTokenRequestSchema>;

export const unregisterDeviceToken = defineCallable({
  name: "v1.identity.unregisterDeviceToken",
  module: "identity",
  requestSchema: UnregisterDeviceTokenRequestSchema,
  responseSchema: DeviceTokenAckSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "domain:token",
  invalidates: ["device"],
});

// ── sendDirectMessage (C14) ───────────────────────────────────────────────────
export const SendDirectMessageRequestSchema = z
  .object({
    recipientUids: z.array(zUserId).min(1),
    title: z.string().max(200),
    body: z.string().max(5000),
  })
  .strict();
export type SendDirectMessageRequest = z.infer<typeof SendDirectMessageRequestSchema>;

export const SendDirectMessageResponseSchema = z
  .object({ sent: z.literal(true), count: z.number().int() })
  .strict();

export const sendDirectMessage = defineCallable({
  name: "v1.identity.sendDirectMessage",
  module: "identity",
  requestSchema: SendDirectMessageRequestSchema,
  responseSchema: SendDirectMessageResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["message"],
});

export const NOTIFICATION_CALLABLES = {
  saveAnnouncement,
  listAnnouncements,
  markAnnouncementRead,
  estimateAudience,
  listNotifications,
  getNotificationBadge,
  markNotificationRead,
  getNotificationPreferences,
  saveNotificationPreferences,
  registerDeviceToken,
  unregisterDeviceToken,
  sendDirectMessage,
} as const satisfies Record<string, CallableDef>;
