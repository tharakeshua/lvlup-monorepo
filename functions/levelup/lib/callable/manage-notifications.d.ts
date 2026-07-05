/**
 * Consolidated endpoint: replaces getNotifications + markNotificationRead.
 * - action: 'list' = get paginated notifications
 * - action: 'markRead' = mark single or all notifications as read
 */
export declare const manageNotifications: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        notifications: {
          id: string;
          type: any;
          title: any;
          body: any;
          isRead: any;
          createdAt: import("@levelup/domain").Timestamp | null;
          entityType: any;
          entityId: any;
          actionUrl: any;
        }[];
        nextCursor: string | undefined;
        success?: undefined;
      }
    | {
        success: true;
        notifications?: undefined;
        nextCursor?: undefined;
      }
  >,
  unknown
>;
