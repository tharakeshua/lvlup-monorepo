"use strict";
/**
 * onUserStoryPointProgressWrite — Firestore trigger that updates leaderboard
 * and student summary metrics when a student completes a story point.
 *
 * Triggers on: /tenants/{tenantId}/spaceProgress/{progressId}
 * (same collection as on-space-progress-updated, but focuses on the
 * per-story-point breakdown within SpaceProgress.storyPoints)
 *
 * When a story point transitions to 'completed', this trigger:
 * 1. Updates the story-point-level leaderboard in RTDB
 * 2. Recalculates LevelUp metrics on the student's progress summary
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
exports.onUserStoryPointProgressWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const firestore_2 = require("firebase-admin/firestore");
const aggregation_helpers_1 = require("../utils/aggregation-helpers");
exports.onUserStoryPointProgressWrite = (0, firestore_1.onDocumentWritten)(
  {
    document: "tenants/{tenantId}/spaceProgress/{progressId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!afterData) return; // deleted — skip
    const { tenantId } = event.params;
    const userId = afterData.userId;
    const spaceId = afterData.spaceId;
    // Compare story point statuses: find newly completed story points
    const beforeStoryPoints = beforeData?.storyPoints ?? {};
    const afterStoryPoints = afterData.storyPoints ?? {};
    const newlyCompleted = [];
    for (const [spId, afterSp] of Object.entries(afterStoryPoints)) {
      const beforeSp = beforeStoryPoints[spId];
      if (afterSp.status === "completed" && (!beforeSp || beforeSp.status !== "completed")) {
        newlyCompleted.push({ storyPointId: spId, progress: afterSp });
      }
    }
    if (newlyCompleted.length === 0) return;
    const db = admin.firestore();
    const rtdb = admin.database();
    // Calculate total score across all story points in this space
    let totalPointsEarned = 0;
    let totalPointsAvailable = 0;
    let completedCount = 0;
    const totalStoryPoints = Object.keys(afterStoryPoints).length;
    for (const sp of Object.values(afterStoryPoints)) {
      totalPointsEarned += sp.pointsEarned ?? 0;
      totalPointsAvailable += sp.totalPoints ?? 0;
      if (sp.status === "completed") completedCount++;
    }
    // Update RTDB leaderboard for each newly completed story point
    const updates = {};
    for (const { storyPointId, progress } of newlyCompleted) {
      const leaderboardPath = `storyPointLeaderboard/${storyPointId}/${userId}`;
      updates[leaderboardPath] = {
        score: progress.pointsEarned ?? 0,
        percentage: progress.percentage ?? 0,
        completedAt: progress.completedAt ?? Date.now(),
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };
      console.log(
        `Story point ${storyPointId} completed by ${userId}: ${progress.pointsEarned}/${progress.totalPoints} points`
      );
    }
    // Also update course-level leaderboard with aggregate score
    const courseLeaderboardPath = `courseLeaderboard/${spaceId}/${userId}`;
    updates[courseLeaderboardPath] = {
      score: totalPointsEarned,
      totalPoints: totalPointsAvailable,
      completedStoryPoints: completedCount,
      totalStoryPoints,
      percentage:
        totalPointsAvailable > 0 ? Math.round((totalPointsEarned / totalPointsAvailable) * 100) : 0,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    };
    // Write all RTDB updates atomically
    await rtdb.ref().update(updates);
    // Update student progress summary with fresh LevelUp metrics
    // (Reuse the same aggregation logic from on-space-progress-updated)
    const summaryRef = db.doc(`tenants/${tenantId}/studentProgressSummaries/${userId}`);
    await db.runTransaction(async (transaction) => {
      const existingSummary = (await transaction.get(summaryRef)).data();
      // Merge the updated space-level metrics into the existing levelup section
      const existingLevelup = existingSummary?.levelup ?? {};
      const autogradeBreakdown = existingSummary?.autograde?.subjectBreakdown ?? {};
      const levelupBreakdown = existingLevelup.subjectBreakdown ?? {};
      const autogradeAvgScore = existingSummary?.autograde?.averageScore ?? 0;
      const levelupAvgCompletion = existingLevelup.averageCompletion ?? 0;
      const { strengths, weaknesses } = (0, aggregation_helpers_1.identifyStrengthsAndWeaknesses)(
        autogradeBreakdown,
        levelupBreakdown
      );
      const overallScore = (0, aggregation_helpers_1.computeOverallScore)(
        autogradeAvgScore,
        levelupAvgCompletion
      );
      transaction.set(
        summaryRef,
        {
          id: userId,
          tenantId,
          studentId: userId,
          overallScore,
          strengthAreas: strengths,
          weaknessAreas: weaknesses,
          lastUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    console.log(
      `Updated leaderboard and summary for ${userId}: ${newlyCompleted.length} story points completed in space ${spaceId}`
    );
  }
);
//# sourceMappingURL=on-user-story-point-progress-write.js.map
