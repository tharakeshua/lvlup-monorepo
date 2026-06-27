import { zEnum } from "./enum.js";

/**
 * Notification enums (notification domain). `recipientUid` is the canonical
 * recipient field (REVIEW D12 — schema↔interface schism reconciled to the auth
 * uid name, consistent with the authUid-not-uid rule D3).
 */
export const NOTIFICATION_TYPES = [
  "exam_results_released",
  "new_exam_assigned",
  "new_space_assigned",
  "submission_graded",
  "grading_complete",
  "student_at_risk",
  "deadline_reminder",
  "space_published",
  "bulk_import_complete",
  "ai_budget_alert",
  "system_announcement",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const zNotificationType = zEnum(NOTIFICATION_TYPES);

export const NOTIFICATION_ENTITY_TYPES = [
  "exam",
  "space",
  "submission",
  "student",
  "class",
] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];
export const zNotificationEntityType = zEnum(NOTIFICATION_ENTITY_TYPES);

export const NOTIFICATION_RECIPIENT_ROLES = [
  "teacher",
  "student",
  "parent",
  "tenantAdmin",
] as const;
export type NotificationRecipientRole = (typeof NOTIFICATION_RECIPIENT_ROLES)[number];
export const zNotificationRecipientRole = zEnum(NOTIFICATION_RECIPIENT_ROLES);
