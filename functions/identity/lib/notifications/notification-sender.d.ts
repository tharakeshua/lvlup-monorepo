export interface NotificationPayload {
  tenantId: string;
  recipientId: string;
  recipientRole: "teacher" | "student" | "parent" | "tenantAdmin";
  type: string;
  title: string;
  body: string;
  entityType?: "exam" | "space" | "submission" | "student" | "class";
  entityId?: string;
  actionUrl?: string;
}
/**
 * Send a single notification: writes to Firestore and updates RTDB unread count.
 */
export declare function sendNotification(payload: NotificationPayload): Promise<string>;
/**
 * Send bulk notifications to multiple recipients with the same content.
 * Uses Firestore batch writes (max 450 per batch) for efficiency.
 */
export declare function sendBulkNotifications(
  recipientIds: string[],
  basePayload: Omit<NotificationPayload, "recipientId">,
  recipientRoleOverrides?: Record<string, "teacher" | "student" | "parent" | "tenantAdmin">
): Promise<number>;
