/**
 * onSpacePublished — Firestore trigger that sends notifications to enrolled
 * students when a space's status changes to 'published'.
 *
 * Triggers on: /tenants/{tenantId}/spaces/{spaceId}
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { sendBulkNotifications } from "../utils/notification-sender";

export const onSpacePublished = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/spaces/{spaceId}",
    region: "asia-south1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when status changes to published
    if (before.status === "published" || after.status !== "published") {
      return;
    }

    const { tenantId, spaceId } = event.params;
    const db = admin.firestore();
    const spaceTitle = after.title ?? "Untitled Space";
    const spaceType = after.type ?? "learning";
    const classIds: string[] = after.classIds ?? [];

    if (classIds.length === 0) {
      logger.info(`Space ${spaceId} published with no classIds — skipping notifications.`);
      return;
    }

    // Collect unique student IDs from all assigned classes
    const studentIdSet = new Set<string>();

    for (let i = 0; i < classIds.length; i += 10) {
      const batch = classIds.slice(i, i + 10);
      const classSnaps = await Promise.all(
        batch.map((classId) => db.doc(`tenants/${tenantId}/classes/${classId}`).get())
      );
      for (const snap of classSnaps) {
        if (!snap.exists) continue;
        const classData = snap.data();
        const ids: string[] = classData?.studentIds ?? [];
        for (const id of ids) {
          studentIdSet.add(id);
        }
      }
    }

    const studentIds = Array.from(studentIdSet);

    if (studentIds.length === 0) {
      logger.info(`Space ${spaceId} published but no students in assigned classes.`);
      return;
    }

    const sent = await sendBulkNotifications(studentIds, {
      tenantId,
      recipientRole: "student",
      type: "space_published",
      title: "New Learning Space Available",
      body: `"${spaceTitle}" (${spaceType}) is now available. Start learning!`,
      entityType: "space",
      entityId: spaceId,
      actionUrl: `/spaces/${spaceId}`,
    });

    logger.info(
      `onSpacePublished: Sent ${sent} notifications for space ${spaceId} "${spaceTitle}"`
    );
  }
);
