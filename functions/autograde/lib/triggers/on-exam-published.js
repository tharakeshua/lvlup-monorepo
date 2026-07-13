"use strict";
/**
 * onExamPublished — Firestore trigger that sends notifications to students
 * in the exam's assigned classes when the exam status changes to 'published'.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
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
exports.onExamPublished = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const notification_sender_1 = require("../utils/notification-sender");
exports.onExamPublished = (0, firestore_1.onDocumentUpdated)(
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
    const classIds = after.classIds ?? [];
    const totalMarks = after.totalMarks ?? 0;
    if (classIds.length === 0) {
      v2_1.logger.info(`Exam ${examId} published with no classIds — skipping notifications.`);
      return;
    }
    // Collect unique student IDs from all assigned classes
    const studentIdSet = new Set();
    for (let i = 0; i < classIds.length; i += 10) {
      const batch = classIds.slice(i, i + 10);
      const classSnaps = await Promise.all(
        batch.map((classId) => db.doc(`tenants/${tenantId}/classes/${classId}`).get())
      );
      for (const snap of classSnaps) {
        if (!snap.exists) continue;
        const classData = snap.data();
        const ids = classData?.studentIds ?? [];
        for (const id of ids) {
          studentIdSet.add(id);
        }
      }
    }
    const studentIds = Array.from(studentIdSet);
    if (studentIds.length === 0) {
      v2_1.logger.info(`Exam ${examId} published but no students in assigned classes.`);
      return;
    }
    const bodyParts = [`"${examTitle}"`];
    if (subject) bodyParts.push(`(${subject})`);
    if (totalMarks > 0) bodyParts.push(`— ${totalMarks} marks`);
    bodyParts.push("has been assigned to you.");
    const sent = await (0, notification_sender_1.sendBulkNotifications)(studentIds, {
      tenantId,
      recipientRole: "student",
      type: "new_exam_assigned",
      title: "New Exam Assigned",
      body: bodyParts.join(" "),
      entityType: "exam",
      entityId: examId,
      actionUrl: `/exams/${examId}`,
    });
    v2_1.logger.info(
      `onExamPublished: Sent ${sent} notifications for exam ${examId} "${examTitle}"`
    );
  }
);
//# sourceMappingURL=on-exam-published.js.map
