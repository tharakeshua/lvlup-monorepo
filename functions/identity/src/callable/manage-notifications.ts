import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { ManageNotificationsRequestSchema } from "@levelup/shared-types";
import type { ManageNotificationsResponse } from "@levelup/shared-types";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * Consolidated endpoint: replaces getNotifications + markNotificationRead.
 * - action: 'list' = get paginated notifications
 * - action: 'markRead' = mark single or all notifications as read
 */
export const manageNotifications = onCall(
  { region: "asia-south1", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const reqData = parseRequest(request.data, ManageNotificationsRequestSchema);

    if (!reqData.tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }

    await enforceRateLimit(reqData.tenantId, uid, "read", 60);

    const db = admin.firestore();

    if (reqData.action === "list") {
      // ── LIST NOTIFICATIONS ──
      const pageSize = Math.min(reqData.limit ?? 20, 50);

      let query = db
        .collection(`tenants/${reqData.tenantId}/notifications`)
        .where("recipientId", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(pageSize);

      if (reqData.cursor) {
        const cursorDoc = await db
          .doc(`tenants/${reqData.tenantId}/notifications/${reqData.cursor}`)
          .get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snap = await query.get();
      const notifications = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          type: d.type,
          title: d.title,
          body: d.body,
          isRead: d.isRead ?? false,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
          entityType: d.entityType,
          entityId: d.entityId,
          actionUrl: d.actionUrl,
        };
      });

      const lastDoc = snap.docs[snap.docs.length - 1];

      return {
        notifications,
        nextCursor: snap.size === pageSize ? lastDoc?.id : undefined,
      } satisfies ManageNotificationsResponse;
    } else if (reqData.action === "markRead") {
      // ── MARK READ ──
      const rtdb = admin.database();
      const now = FieldValue.serverTimestamp();

      if (reqData.notificationId && !reqData.markAllRead) {
        // Mark single notification as read
        const notifRef = db.doc(
          `tenants/${reqData.tenantId}/notifications/${reqData.notificationId}`
        );
        const notifSnap = await notifRef.get();

        if (!notifSnap.exists) {
          throw new HttpsError("not-found", "Notification not found");
        }

        if (notifSnap.data()?.recipientId !== uid) {
          throw new HttpsError("permission-denied", "Not your notification");
        }

        if (!notifSnap.data()?.isRead) {
          await notifRef.update({ isRead: true, readAt: now });

          // Decrement RTDB unread count
          const countPath = `notifications/${reqData.tenantId}/${uid}/unreadCount`;
          await rtdb.ref(countPath).transaction((current: number | null) => {
            return Math.max((current ?? 0) - 1, 0);
          });
        }

        return { success: true } satisfies ManageNotificationsResponse;
      } else {
        // Mark all unread notifications as read
        const unreadSnap = await db
          .collection(`tenants/${reqData.tenantId}/notifications`)
          .where("recipientId", "==", uid)
          .where("isRead", "==", false)
          .get();

        if (!unreadSnap.empty) {
          const BATCH_SIZE = 450;
          for (let i = 0; i < unreadSnap.docs.length; i += BATCH_SIZE) {
            const chunk = unreadSnap.docs.slice(i, i + BATCH_SIZE);
            const batch = db.batch();
            for (const doc of chunk) {
              batch.update(doc.ref, { isRead: true, readAt: now });
            }
            await batch.commit();
          }

          // Reset RTDB unread count
          await rtdb.ref(`notifications/${reqData.tenantId}/${uid}/unreadCount`).set(0);
        }

        return { success: true } satisfies ManageNotificationsResponse;
      }
    } else {
      throw new HttpsError("invalid-argument", 'action must be "list" or "markRead"');
    }
  }
);
