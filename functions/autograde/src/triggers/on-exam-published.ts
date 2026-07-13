/**
 * onExamPublished — Firestore trigger that sends notifications to students
 * in the exam's assigned classes when the exam status changes to 'published'.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { sendBulkNotifications } from "../utils/notification-sender";

export const onExamPublished = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/exams/{examId}",
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

    const { tenantId, examId } = event.params;
    const db = admin.firestore();
    const examTitle = after.title ?? "Untitled Exam";
    const subject = after.subject ?? "";
    const classIds: string[] = after.classIds ?? [];
    const totalMarks = after.totalMarks ?? 0;

    if (classIds.length === 0) {
      logger.info(`Exam ${examId} published with no classIds — skipping notifications.`);
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
      logger.info(`Exam ${examId} published but no students in assigned classes.`);
      return;
    }

    const bodyParts = [`"${examTitle}"`];
    if (subject) bodyParts.push(`(${subject})`);
    if (totalMarks > 0) bodyParts.push(`— ${totalMarks} marks`);
    bodyParts.push("has been assigned to you.");

    const sent = await sendBulkNotifications(studentIds, {
      tenantId,
      recipientRole: "student",
      type: "new_exam_assigned",
      title: "New Exam Assigned",
      body: bodyParts.join(" "),
      entityType: "exam",
      entityId: examId,
      actionUrl: `/exams/${examId}`,
    });

    logger.info(`onExamPublished: Sent ${sent} notifications for exam ${examId} "${examTitle}"`);
  }
);
