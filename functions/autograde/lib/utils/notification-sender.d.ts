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
export declare function sendNotification(payload: NotificationPayload): Promise<string>;
export declare function sendBulkNotifications(
  recipientIds: string[],
  basePayload: Omit<NotificationPayload, "recipientId">
): Promise<number>;
