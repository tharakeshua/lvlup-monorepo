"use strict";
/**
 * onResultsReleased — Firestore trigger that sends notifications to students
 * (and their parents) when exam results are released.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 *
 * Also notifies the teacher who created the exam.
 */
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
exports.onResultsReleased = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const notification_sender_1 = require("../utils/notification-sender");
exports.onResultsReleased = (0, firestore_1.onDocumentUpdated)(
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
      v2_1.logger.info(`No submissions for exam ${examId} — skipping notifications.`);
      return;
    }
    // Collect student IDs who have submissions
    const studentIds = submissionsSnap.docs.map((d) => d.data().studentId);
    const uniqueStudentIds = [...new Set(studentIds)];
    // Notify students
    const bodyText = subject
      ? `Results for "${examTitle}" (${subject}) have been released. Check your scores!`
      : `Results for "${examTitle}" have been released. Check your scores!`;
    const sentStudents = await (0, notification_sender_1.sendBulkNotifications)(uniqueStudentIds, {
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
    const parentIdSet = new Set();
    for (let i = 0; i < uniqueStudentIds.length; i += 30) {
      const batch = uniqueStudentIds.slice(i, i + 30);
      const studentsSnap = await db
        .collection(`tenants/${tenantId}/students`)
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();
      for (const doc of studentsSnap.docs) {
        const parentIds = doc.data().parentIds ?? [];
        for (const pid of parentIds) {
          parentIdSet.add(pid);
        }
      }
    }
    let sentParents = 0;
    if (parentIdSet.size > 0) {
      sentParents = await (0, notification_sender_1.sendBulkNotifications)(
        Array.from(parentIdSet),
        {
          tenantId,
          recipientRole: "parent",
          type: "exam_results_released",
          title: "Exam Results Released",
          body: `Results for "${examTitle}" have been released for your child.`,
          entityType: "exam",
          entityId: examId,
          actionUrl: `/results`,
        }
      );
    }
    // Notify the teacher who created the exam
    if (after.createdBy) {
      await (0, notification_sender_1.sendNotification)({
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
    v2_1.logger.info(
      `onResultsReleased: Exam ${examId} "${examTitle}" — ` +
        `${sentStudents} student notifs, ${sentParents} parent notifs`
    );
  }
);
//# sourceMappingURL=on-results-released.js.map
