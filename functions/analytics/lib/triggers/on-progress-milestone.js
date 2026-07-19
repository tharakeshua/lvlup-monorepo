"use strict";
/**
 * onProgressMilestone — Firestore trigger that sends notifications when a
 * student's progress summary changes and they hit achievement milestones.
 *
 * Milestones:
 *   - First exam completed
 *   - Exam average crosses 80% threshold
 *   - First space completed
 *   - All spaces completed
 *   - 7-day streak achieved
 *   - Student newly at-risk (notify admin + parent)
 *   - Student no longer at-risk (notify parent)
 *
 * Triggers on: /tenants/{tenantId}/studentProgressSummaries/{studentId}
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
exports.onProgressMilestone = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const notification_sender_1 = require("../utils/notification-sender");
exports.onProgressMilestone = (0, firestore_1.onDocumentUpdated)(
  {
    document: "tenants/{tenantId}/studentProgressSummaries/{studentId}",
    region: "asia-south1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const { tenantId, studentId } = event.params;
    const db = admin.firestore();
    let notificationsSent = 0;
    // Helper to build student display name
    const studentName = after.studentName ?? studentId.slice(0, 10);
    // ── Milestone: First exam completed ──────────────────────────────────
    const prevExams = before.autograde?.completedExams ?? 0;
    const currExams = after.autograde?.completedExams ?? 0;
    if (prevExams === 0 && currExams > 0) {
      await (0, notification_sender_1.sendNotification)({
        tenantId,
        recipientId: studentId,
        recipientRole: "student",
        type: "submission_graded",
        title: "First Exam Completed!",
        body: "Congratulations on completing your first exam. Keep up the great work!",
        entityType: "student",
        entityId: studentId,
        actionUrl: "/results",
      });
      notificationsSent++;
    }
    // ── Milestone: Exam average crosses 80% ─────────────────────────────
    const prevAvg = before.autograde?.averagePercentage ?? 0;
    const currAvg = after.autograde?.averagePercentage ?? 0;
    if (prevAvg < 80 && currAvg >= 80 && currExams > 0) {
      await (0, notification_sender_1.sendNotification)({
        tenantId,
        recipientId: studentId,
        recipientRole: "student",
        type: "submission_graded",
        title: "Outstanding Performance!",
        body: `Your exam average has reached ${Math.round(currAvg)}%. Excellent work!`,
        entityType: "student",
        entityId: studentId,
        actionUrl: "/results",
      });
      notificationsSent++;
    }
    // ── Milestone: First space completed ─────────────────────────────────
    const prevSpaces = before.levelup?.completedSpaces ?? 0;
    const currSpaces = after.levelup?.completedSpaces ?? 0;
    if (prevSpaces === 0 && currSpaces > 0) {
      await (0, notification_sender_1.sendNotification)({
        tenantId,
        recipientId: studentId,
        recipientRole: "student",
        type: "space_published",
        title: "First Space Completed!",
        body: "You completed your first learning space. Great progress!",
        entityType: "student",
        entityId: studentId,
        actionUrl: "/spaces",
      });
      notificationsSent++;
    }
    // ── Milestone: All spaces completed ──────────────────────────────────
    const totalSpaces = after.levelup?.totalSpaces ?? 0;
    if (totalSpaces > 0 && currSpaces === totalSpaces && prevSpaces < totalSpaces) {
      await (0, notification_sender_1.sendNotification)({
        tenantId,
        recipientId: studentId,
        recipientRole: "student",
        type: "space_published",
        title: "All Spaces Completed!",
        body: `Amazing! You have completed all ${totalSpaces} learning spaces.`,
        entityType: "student",
        entityId: studentId,
        actionUrl: "/spaces",
      });
      notificationsSent++;
    }
    // ── Milestone: 7-day streak ──────────────────────────────────────────
    const prevStreak = before.levelup?.streakDays ?? 0;
    const currStreak = after.levelup?.streakDays ?? 0;
    if (prevStreak < 7 && currStreak >= 7) {
      await (0, notification_sender_1.sendNotification)({
        tenantId,
        recipientId: studentId,
        recipientRole: "student",
        type: "space_published",
        title: "7-Day Streak!",
        body: `You've been learning for ${currStreak} days in a row. Keep it going!`,
        entityType: "student",
        entityId: studentId,
        actionUrl: "/spaces",
      });
      notificationsSent++;
    }
    // ── At-Risk transitions ──────────────────────────────────────────────
    const wasAtRisk = before.isAtRisk === true;
    const isAtRisk = after.isAtRisk === true;
    const atRiskReasons = after.atRiskReasons ?? [];
    if (!wasAtRisk && isAtRisk) {
      // Student became at-risk — notify admins and parents
      const reasonText =
        atRiskReasons.length > 0 ? atRiskReasons.join("; ") : "Performance below expected levels";
      // Notify tenant admins
      const adminsSnap = await db
        .collection(`tenants/${tenantId}/teachers`)
        .where("status", "==", "active")
        .get();
      // Also check for tenantAdmin role memberships
      const adminMembershipsSnap = await db
        .collection("userMemberships")
        .where("tenantId", "==", tenantId)
        .where("role", "==", "tenantAdmin")
        .where("status", "==", "active")
        .limit(20)
        .get();
      const adminIds = new Set();
      for (const doc of adminMembershipsSnap.docs) {
        adminIds.add(doc.data().uid);
      }
      if (adminIds.size > 0) {
        await (0, notification_sender_1.sendBulkNotifications)(Array.from(adminIds), {
          tenantId,
          recipientRole: "tenantAdmin",
          type: "student_at_risk",
          title: "Student At-Risk Alert",
          body: `Student ${studentName} is now flagged as at-risk: ${reasonText}`,
          entityType: "student",
          entityId: studentId,
          actionUrl: `/analytics`,
        });
        notificationsSent += adminIds.size;
      }
      // Notify parents
      const studentDoc = await db.doc(`tenants/${tenantId}/students/${studentId}`).get();
      const parentIds = studentDoc.data()?.parentIds ?? [];
      if (parentIds.length > 0) {
        await (0, notification_sender_1.sendBulkNotifications)(parentIds, {
          tenantId,
          recipientRole: "parent",
          type: "student_at_risk",
          title: "At-Risk Alert for Your Child",
          body: `Your child's performance needs attention: ${reasonText}`,
          entityType: "student",
          entityId: studentId,
          actionUrl: "/child-progress",
        });
        notificationsSent += parentIds.length;
      }
    }
    if (wasAtRisk && !isAtRisk) {
      // Student recovered — notify parents
      const studentDoc = await db.doc(`tenants/${tenantId}/students/${studentId}`).get();
      const parentIds = studentDoc.data()?.parentIds ?? [];
      if (parentIds.length > 0) {
        await (0, notification_sender_1.sendBulkNotifications)(parentIds, {
          tenantId,
          recipientRole: "parent",
          type: "student_at_risk",
          title: "Good News About Your Child",
          body: `Your child is no longer flagged as at-risk. Their performance has improved!`,
          entityType: "student",
          entityId: studentId,
          actionUrl: "/child-progress",
        });
        notificationsSent += parentIds.length;
      }
    }
    if (notificationsSent > 0) {
      v2_1.logger.info(
        `onProgressMilestone: ${notificationsSent} notifications for student ${studentId}`
      );
    }
  }
);
//# sourceMappingURL=on-progress-milestone.js.map
