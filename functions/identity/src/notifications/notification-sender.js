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
exports.sendNotification = sendNotification;
exports.sendBulkNotifications = sendBulkNotifications;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
/**
 * Send a single notification: writes to Firestore and updates RTDB unread count.
 */
async function sendNotification(payload) {
  const db = admin.firestore();
  const rtdb = admin.database();
  const notifRef = db.collection(`tenants/${payload.tenantId}/notifications`).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await notifRef.set({
    id: notifRef.id,
    tenantId: payload.tenantId,
    recipientId: payload.recipientId,
    recipientRole: payload.recipientRole,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
    actionUrl: payload.actionUrl ?? null,
    isRead: false,
    createdAt: now,
  });
  // Update RTDB for real-time badge
  const rtdbPath = `notifications/${payload.tenantId}/${payload.recipientId}`;
  await rtdb.ref(`${rtdbPath}/unreadCount`).transaction((current) => {
    return (current ?? 0) + 1;
  });
  await rtdb.ref(`${rtdbPath}/latest`).set({
    id: notifRef.id,
    title: payload.title,
    type: payload.type,
    createdAt: Date.now(),
  });
  v2_1.logger.info(`Notification sent: ${payload.type} to ${payload.recipientId}`);
  return notifRef.id;
}
/**
 * Send bulk notifications to multiple recipients with the same content.
 * Uses Firestore batch writes (max 450 per batch) for efficiency.
 */
async function sendBulkNotifications(recipientIds, basePayload, recipientRoleOverrides) {
  if (recipientIds.length === 0) return 0;
  const db = admin.firestore();
  const rtdb = admin.database();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const BATCH_SIZE = 450;
  let sent = 0;
  for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
    const chunk = recipientIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const recipientId of chunk) {
      const notifRef = db.collection(`tenants/${basePayload.tenantId}/notifications`).doc();
      const role = recipientRoleOverrides?.[recipientId] ?? basePayload.recipientRole;
      batch.set(notifRef, {
        id: notifRef.id,
        tenantId: basePayload.tenantId,
        recipientId,
        recipientRole: role,
        type: basePayload.type,
        title: basePayload.title,
        body: basePayload.body,
        entityType: basePayload.entityType ?? null,
        entityId: basePayload.entityId ?? null,
        actionUrl: basePayload.actionUrl ?? null,
        isRead: false,
        createdAt: now,
      });
      sent++;
    }
    await batch.commit();
    // Update RTDB unread counts for each recipient
    const rtdbUpdates = {};
    for (const recipientId of chunk) {
      const path = `notifications/${basePayload.tenantId}/${recipientId}`;
      rtdbUpdates[`${path}/latest`] = {
        id: `batch_${Date.now()}`,
        title: basePayload.title,
        type: basePayload.type,
        createdAt: Date.now(),
      };
    }
    await rtdb.ref().update(rtdbUpdates);
    // Increment unread counts individually (transactions required)
    const incrementPromises = chunk.map((recipientId) => {
      const countPath = `notifications/${basePayload.tenantId}/${recipientId}/unreadCount`;
      return rtdb.ref(countPath).transaction((current) => (current ?? 0) + 1);
    });
    await Promise.all(incrementPromises);
  }
  v2_1.logger.info(`Bulk notifications sent: ${sent} recipients for ${basePayload.type}`);
  return sent;
}
//# sourceMappingURL=notification-sender.js.map
