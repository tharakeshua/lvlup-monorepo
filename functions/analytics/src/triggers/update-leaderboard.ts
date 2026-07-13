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

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

export const updateLeaderboard = onDocumentWritten(
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
    const updates: Record<string, unknown> = {};

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
      const spaceId = progress.spaceId as string;

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
function computeTierCounts(
  levelup: Record<string, unknown> | undefined
): Record<string, number> | null {
  if (!levelup?.subjectBreakdown) return null;

  const breakdown = levelup.subjectBreakdown as Record<string, { avgCompletion?: number }>;
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
async function handleDeletion(params: { tenantId: string; studentId: string }): Promise<void> {
  const { tenantId, studentId } = params;
  const rtdb = admin.database();

  // Remove from tenant leaderboard
  await rtdb.ref(`tenantLeaderboard/${tenantId}/${studentId}`).remove();

  console.log(`Removed leaderboard entry for deleted student ${studentId} in tenant ${tenantId}`);
}
