import type { FirestoreTimestamp } from "../identity/user";

/**
 * Notification types for the in-app notification system.
 * Collection: /tenants/{tenantId}/notifications/{notificationId}
 */

export type NotificationType =
  | "exam_results_released"
  | "new_exam_assigned"
  | "new_space_assigned"
  | "submission_graded"
  | "grading_complete"
  | "student_at_risk"
  | "deadline_reminder"
  | "space_published"
  | "bulk_import_complete"
  | "ai_budget_alert"
  | "system_announcement";

export type NotificationEntityType = "exam" | "space" | "submission" | "student" | "class";

export type NotificationRecipientRole = "teacher" | "student" | "parent" | "tenantAdmin";

export interface Notification {
  id: string;
  tenantId: string;
  recipientId: string;
  recipientRole: NotificationRecipientRole;

  type: NotificationType;
  title: string;
  body: string;

  entityType?: NotificationEntityType;
  entityId?: string;
  actionUrl?: string;

  isRead: boolean;
  createdAt: FirestoreTimestamp;
  readAt?: FirestoreTimestamp;
}

/**
 * User notification preferences.
 * Collection: /tenants/{tenantId}/notificationPreferences/{userId}
 */
export interface NotificationPreferences {
  id: string;
  tenantId: string;
  userId: string;
  enabledTypes: NotificationType[];
  muteUntil?: FirestoreTimestamp;
}

/**
 * Lightweight RTDB notification state for real-time badge updates.
 * Path: /notifications/{tenantId}/{userId}/
 */
export interface NotificationRTDBState {
  unreadCount: number;
  latest?: {
    id: string;
    title: string;
    type: NotificationType;
    createdAt: number;
  };
}
