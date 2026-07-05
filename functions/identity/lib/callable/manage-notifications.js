"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.manageNotifications = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consolidated endpoint: replaces getNotifications + markNotificationRead.
 * - action: 'list' = get paginated notifications
 * - action: 'markRead' = mark single or all notifications as read
 */
exports.manageNotifications = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = request.auth.uid;
    const reqData = (0, utils_1.parseRequest)(
      request.data,
      wire_1.ManageNotificationsRequestSchema
    );
    if (!reqData.tenantId) {
      throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await (0, rate_limit_1.enforceRateLimit)(reqData.tenantId, uid, "read", 60);
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
          // B8: timestamps at rest are canonical ISO strings; collapse legacy
          // Firestore Timestamp objects (old docs) and ISO strings uniformly.
          createdAt: (0, domain_1.toTimestamp)(d.createdAt),
          entityType: d.entityType,
          entityId: d.entityId,
          actionUrl: d.actionUrl,
        };
      });
      const lastDoc = snap.docs[snap.docs.length - 1];
      return {
        notifications,
        nextCursor: snap.size === pageSize ? lastDoc?.id : undefined,
      };
    } else if (reqData.action === "markRead") {
      // ── MARK READ ──
      const rtdb = admin.database();
      const now = (0, domain_1.isoNow)();
      if (reqData.notificationId && !reqData.markAllRead) {
        // Mark single notification as read
        const notifRef = db.doc(
          `tenants/${reqData.tenantId}/notifications/${reqData.notificationId}`
        );
        const notifSnap = await notifRef.get();
        if (!notifSnap.exists) {
          throw new https_1.HttpsError("not-found", "Notification not found");
        }
        if (notifSnap.data()?.recipientId !== uid) {
          throw new https_1.HttpsError("permission-denied", "Not your notification");
        }
        if (!notifSnap.data()?.isRead) {
          await notifRef.update({ isRead: true, readAt: now });
          // Decrement RTDB unread count
          const countPath = `notifications/${reqData.tenantId}/${uid}/unreadCount`;
          await rtdb.ref(countPath).transaction((current) => {
            return Math.max((current ?? 0) - 1, 0);
          });
        }
        return { success: true };
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
        return { success: true };
      }
    } else {
      throw new https_1.HttpsError("invalid-argument", 'action must be "list" or "markRead"');
    }
  }
);
//# sourceMappingURL=manage-notifications.js.map
