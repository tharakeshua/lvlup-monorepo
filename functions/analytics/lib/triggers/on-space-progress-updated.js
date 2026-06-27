"use strict";
/**
 * onSpaceProgressUpdated — Firestore trigger that recalculates the LevelUp
 * section of a student's progress summary when space progress changes.
 *
 * Triggers on: /tenants/{tenantId}/spaceProgress/{progressId}
 * progressId format: {userId}_{spaceId}
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
exports.onSpaceProgressUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const firestore_2 = require("firebase-admin/firestore");
const aggregation_helpers_1 = require("../utils/aggregation-helpers");
exports.onSpaceProgressUpdated = (0, firestore_1.onDocumentWritten)(
  {
    document: "tenants/{tenantId}/spaceProgress/{progressId}",
    region: "asia-south1",
    memory: "512MiB",
  },
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return; // deleted — skip
    const { tenantId } = event.params;
    const userId = after.userId;
    const db = admin.firestore();
    // Fetch all space progress records for this student
    const progressSnap = await db
      .collection(`tenants/${tenantId}/spaceProgress`)
      .where("userId", "==", userId)
      .get();
    // Build space lookup for titles and subjects
    const spaceIds = [...new Set(progressSnap.docs.map((d) => d.data().spaceId))];
    const spaceMap = new Map();
    for (let i = 0; i < spaceIds.length; i += 30) {
      const batch = spaceIds.slice(i, i + 30);
      const spacesSnap = await db
        .collection(`tenants/${tenantId}/spaces`)
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();
      for (const doc of spacesSnap.docs) {
        const s = doc.data();
        spaceMap.set(doc.id, { title: s.title, subject: s.subject ?? "General" });
      }
    }
    // Aggregate
    let totalPointsEarned = 0;
    let totalPointsAvailable = 0;
    let completedSpaces = 0;
    let totalPercentage = 0;
    const subjectData = {};
    const recentActivity = [];
    for (const doc of progressSnap.docs) {
      const prog = doc.data();
      const space = spaceMap.get(prog.spaceId);
      totalPointsEarned += prog.pointsEarned ?? 0;
      totalPointsAvailable += prog.totalPoints ?? 0;
      totalPercentage += prog.percentage ?? 0;
      if (prog.status === "completed") completedSpaces++;
      const subject = space?.subject ?? "General";
      if (!subjectData[subject]) {
        subjectData[subject] = { totalCompletion: 0, count: 0 };
      }
      subjectData[subject].totalCompletion += prog.percentage ?? 0;
      subjectData[subject].count += 1;
      recentActivity.push({
        spaceId: prog.spaceId,
        spaceTitle: space?.title ?? prog.spaceId,
        action: prog.status === "completed" ? "completed" : "in_progress",
        date: prog.updatedAt,
      });
    }
    const totalSpaces = progressSnap.size;
    const averageCompletion = totalSpaces > 0 ? totalPercentage / totalSpaces : 0;
    const averageAccuracy = totalPointsAvailable > 0 ? totalPointsEarned / totalPointsAvailable : 0;
    const subjectBreakdown = {};
    for (const [subject, data] of Object.entries(subjectData)) {
      subjectBreakdown[subject] = {
        avgCompletion: data.count > 0 ? data.totalCompletion / data.count : 0,
        spaceCount: data.count,
      };
    }
    const sortedRecent = (0, aggregation_helpers_1.topN)(recentActivity, 10, (e) =>
      e.date?.toMillis ? e.date.toMillis() : 0
    );
    const levelup = {
      totalSpaces,
      completedSpaces,
      averageCompletion,
      totalPointsEarned,
      totalPointsAvailable,
      averageAccuracy,
      streakDays: 0, // TODO: compute from RTDB practiceProgress when available
      subjectBreakdown,
      recentActivity: sortedRecent,
    };
    // Use a transaction for atomic read-modify-write to prevent concurrent overwrites
    const summaryRef = db.doc(`tenants/${tenantId}/studentProgressSummaries/${userId}`);
    await db.runTransaction(async (transaction) => {
      const existingSummary = (await transaction.get(summaryRef)).data();
      const autogradeBreakdown = existingSummary?.autograde?.subjectBreakdown ?? {};
      const { strengths, weaknesses } = (0, aggregation_helpers_1.identifyStrengthsAndWeaknesses)(
        autogradeBreakdown,
        subjectBreakdown
      );
      const autogradeAvgScore = existingSummary?.autograde?.averageScore ?? 0;
      const overallScore = (0, aggregation_helpers_1.computeOverallScore)(
        autogradeAvgScore,
        averageCompletion
      );
      transaction.set(
        summaryRef,
        {
          id: userId,
          tenantId,
          studentId: userId,
          levelup,
          overallScore,
          strengthAreas: strengths,
          weaknessAreas: weaknesses,
          lastUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    console.log(
      `Updated levelup summary for student ${userId}: ${totalSpaces} spaces, ${averageCompletion.toFixed(1)}% avg completion`
    );
  }
);
//# sourceMappingURL=on-space-progress-updated.js.map
