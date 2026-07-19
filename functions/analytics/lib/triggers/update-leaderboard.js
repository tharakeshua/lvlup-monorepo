"use strict";
/**
 * updateLeaderboard — Firestore trigger that updates RTDB leaderboard entries
 * when a student's progress summary changes.
 *
 * Triggers on: /tenants/{tenantId}/studentProgressSummaries/{studentId}
 *
 * Updates two leaderboard nodes in RTDB:
 * 1. Per-space leaderboard (courseLeaderboard/{spaceId}/{userId})
 * 2. Tenant-wide leaderboard (tenantLeaderboard/{tenantId}/{userId})
 *
 * These are consumed by the LeaderboardService on the client for real-time
 * ranking displays.
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
exports.updateLeaderboard = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
exports.updateLeaderboard = (0, firestore_1.onDocumentWritten)(
  {
    document: "tenants/{tenantId}/studentProgressSummaries/{studentId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const afterData = event.data?.after.data();
    if (!afterData) {
      // Document deleted — clean up leaderboard entries
      await handleDeletion(event.params);
      return;
    }
    const { tenantId, studentId } = event.params;
    const rtdb = admin.database();
    const db = admin.firestore();
    const levelup = afterData.levelup;
    const autograde = afterData.autograde;
    const overallScore = afterData.overallScore ?? 0;
    // Build the leaderboard entry for this student
    const leaderboardEntry = {
      score: Math.round(overallScore * 1000), // scale to integer for ranking
      overallScore,
      examAvg: autograde?.averagePercentage ?? 0,
      spaceCompletion: levelup?.averageCompletion ?? 0,
      totalPoints: levelup?.totalPointsEarned ?? 0,
      streakDays: levelup?.streakDays ?? 0,
      isAtRisk: afterData.isAtRisk ?? false,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    };
    // Build tier counts from levelup data
    const countsByTier = computeTierCounts(levelup);
    const updates = {};
    if (countsByTier) {
      updates[`tenantLeaderboard/${tenantId}/${studentId}/countsByTier`] = countsByTier;
    }
    // 1. Update tenant-wide leaderboard
    updates[`tenantLeaderboard/${tenantId}/${studentId}`] = leaderboardEntry;
    // 2. Update per-space leaderboards based on space progress
    // Fetch the student's space progress to update per-space boards
    const spaceProgressSnap = await db
      .collection(`tenants/${tenantId}/spaceProgress`)
      .where("userId", "==", studentId)
      .get();
    for (const doc of spaceProgressSnap.docs) {
      const progress = doc.data();
      const spaceId = progress.spaceId;
      updates[`courseLeaderboard/${spaceId}/${studentId}`] = {
        score: progress.pointsEarned ?? 0,
        totalPoints: progress.totalPoints ?? 0,
        percentage: progress.percentage ?? 0,
        status: progress.status ?? "not_started",
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      };
    }
    // Write all updates atomically
    await rtdb.ref().update(updates);
    console.log(
      `Updated leaderboard for student ${studentId} in tenant ${tenantId}: ` +
        `overall=${overallScore.toFixed(2)}, spaces=${spaceProgressSnap.size}`
    );
  }
);
/**
 * Compute tier counts from story point completion data.
 * Tiers are based on percentage: diamond >= 90, platinum >= 75, gold >= 50, silver >= 25
 */
function computeTierCounts(levelup) {
  if (!levelup?.subjectBreakdown) return null;
  const breakdown = levelup.subjectBreakdown;
  const tiers = { diamond: 0, platinum: 0, gold: 0, silver: 0 };
  for (const subject of Object.values(breakdown)) {
    const completion = subject.avgCompletion ?? 0;
    if (completion >= 90) tiers.diamond++;
    else if (completion >= 75) tiers.platinum++;
    else if (completion >= 50) tiers.gold++;
    else if (completion >= 25) tiers.silver++;
  }
  return tiers;
}
/**
 * Clean up leaderboard entries when a student summary is deleted.
 */
async function handleDeletion(params) {
  const { tenantId, studentId } = params;
  const rtdb = admin.database();
  // Remove from tenant leaderboard
  await rtdb.ref(`tenantLeaderboard/${tenantId}/${studentId}`).remove();
  console.log(`Removed leaderboard entry for deleted student ${studentId} in tenant ${tenantId}`);
}
//# sourceMappingURL=update-leaderboard.js.map
