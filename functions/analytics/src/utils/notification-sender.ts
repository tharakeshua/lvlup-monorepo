import * as admin from "firebase-admin";
import { isoNow } from "@levelup/domain";

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

export async function sendNotification(payload: NotificationPayload): Promise<string> {
  const db = admin.firestore();
  const rtdb = admin.database();
  const notifRef = db.collection(`tenants/${payload.tenantId}/notifications`).doc();
  const now = isoNow(); // B8: ISO strings are canonical at rest

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

  const rtdbPath = `notifications/${payload.tenantId}/${payload.recipientId}`;
  await rtdb
    .ref(`${rtdbPath}/unreadCount`)
    .transaction((current: number | null) => (current ?? 0) + 1);
  await rtdb.ref(`${rtdbPath}/latest`).set({
    id: notifRef.id,
    title: payload.title,
    type: payload.type,
    createdAt: Date.now(),
  });

  return notifRef.id;
}

export async function sendBulkNotifications(
  recipientIds: string[],
  basePayload: Omit<NotificationPayload, "recipientId">
): Promise<number> {
  if (recipientIds.length === 0) return 0;

  const db = admin.firestore();
  const rtdb = admin.database();
  const now = isoNow(); // B8: ISO strings are canonical at rest
  const BATCH_SIZE = 450;
  let sent = 0;

  for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
    const chunk = recipientIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const recipientId of chunk) {
      const notifRef = db.collection(`tenants/${basePayload.tenantId}/notifications`).doc();
      batch.set(notifRef, {
        id: notifRef.id,
        tenantId: basePayload.tenantId,
        recipientId,
        recipientRole: basePayload.recipientRole,
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

    const rtdbUpdates: Record<string, unknown> = {};
    for (const recipientId of chunk) {
      rtdbUpdates[`notifications/${basePayload.tenantId}/${recipientId}/latest`] = {
        id: `batch_${Date.now()}`,
        title: basePayload.title,
        type: basePayload.type,
        createdAt: Date.now(),
      };
    }
    await rtdb.ref().update(rtdbUpdates);

    const incrementPromises = chunk.map((recipientId) =>
      rtdb
        .ref(`notifications/${basePayload.tenantId}/${recipientId}/unreadCount`)
        .transaction((current: number | null) => (current ?? 0) + 1)
    );
    await Promise.all(incrementPromises);
  }

  return sent;
}
