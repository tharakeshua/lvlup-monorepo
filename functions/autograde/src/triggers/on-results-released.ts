/**
 * onResultsReleased — Firestore trigger that sends notifications to students
 * (and their parents) when exam results are released.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 *
 * Also notifies the teacher who created the exam.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { sendBulkNotifications, sendNotification } from "../utils/notification-sender";

export const onResultsReleased = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    region: "asia-south1",
    memory: "512MiB",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when status changes to results_released
    if (before.status === "results_released" || after.status !== "results_released") {
      return;
    }

    const { tenantId, examId } = event.params;
    const db = admin.firestore();
    const examTitle = after.title ?? "Untitled Exam";
    const subject = after.subject ?? "";

    // Fetch all submissions for this exam to get student IDs
    const submissionsSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("examId", "==", examId)
      .get();

    if (submissionsSnap.empty) {
      logger.info(`No submissions for exam ${examId} — skipping notifications.`);
      return;
    }

    // Collect student IDs who have submissions
    const studentIds = submissionsSnap.docs.map((d) => d.data().studentId as string);
    const uniqueStudentIds = [...new Set(studentIds)];

    // Notify students
    const bodyText = subject
      ? `Results for "${examTitle}" (${subject}) have been released. Check your scores!`
      : `Results for "${examTitle}" have been released. Check your scores!`;

    const sentStudents = await sendBulkNotifications(uniqueStudentIds, {
      tenantId,
      recipientRole: "student",
      type: "exam_results_released",
      title: "Exam Results Released",
      body: bodyText,
      entityType: "exam",
      entityId: examId,
      actionUrl: `/exams/${examId}/results`,
    });

    // Notify parents of these students
    const parentIdSet = new Set<string>();
    for (let i = 0; i < uniqueStudentIds.length; i += 30) {
      const batch = uniqueStudentIds.slice(i, i + 30);
      const studentsSnap = await db
        .collection(`tenants/${tenantId}/students`)
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();
      for (const doc of studentsSnap.docs) {
        const parentIds: string[] = doc.data().parentIds ?? [];
        for (const pid of parentIds) {
          parentIdSet.add(pid);
        }
      }
    }

    let sentParents = 0;
    if (parentIdSet.size > 0) {
      sentParents = await sendBulkNotifications(Array.from(parentIdSet), {
        tenantId,
        recipientRole: "parent",
        type: "exam_results_released",
        title: "Exam Results Released",
        body: `Results for "${examTitle}" have been released for your child.`,
        entityType: "exam",
        entityId: examId,
        actionUrl: `/results`,
      });
    }

    // Notify the teacher who created the exam
    if (after.createdBy) {
      await sendNotification({
        tenantId,
        recipientId: after.createdBy,
        recipientRole: "teacher",
        type: "exam_results_released",
        title: "Results Released Successfully",
        body: `Results for "${examTitle}" have been released to ${sentStudents} students.`,
        entityType: "exam",
        entityId: examId,
        actionUrl: `/exams/${examId}`,
      });
    }

    logger.info(
      `onResultsReleased: Exam ${examId} "${examTitle}" — ` +
        `${sentStudents} student notifs, ${sentParents} parent notifs`
    );
  }
);
