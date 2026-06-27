/**
 * onSpaceProgressUpdated — Firestore trigger that recalculates the LevelUp
 * section of a student's progress summary when space progress changes.
 *
 * Triggers on: /tenants/{tenantId}/spaceProgress/{progressId}
 * progressId format: {userId}_{spaceId}
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  computeOverallScore,
  identifyStrengthsAndWeaknesses,
  topN,
} from "../utils/aggregation-helpers";
import type { StudentLevelupMetrics, RecentActivityEntry } from "@levelup/shared-types";

export const onSpaceProgressUpdated = onDocumentWritten(
  {
    document: "tenants/{tenantId}/spaceProgress/{progressId}",
    region: "asia-south1",
    memory: "512MiB",
  },
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return; // deleted — skip

    const { tenantId } = event.params;
    const userId = after.userId as string;

    const db = admin.firestore();

    // Fetch all space progress records for this student
    const progressSnap = await db
      .collection(`tenants/${tenantId}/spaceProgress`)
      .where("userId", "==", userId)
      .get();

    // Build space lookup for titles and subjects
    const spaceIds = [...new Set(progressSnap.docs.map((d) => d.data().spaceId as string))];
    const spaceMap = new Map<string, { title: string; subject: string }>();

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
    const subjectData: Record<string, { totalCompletion: number; count: number }> = {};
    const recentActivity: RecentActivityEntry[] = [];

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

    const subjectBreakdown: Record<string, { avgCompletion: number; spaceCount: number }> = {};
    for (const [subject, data] of Object.entries(subjectData)) {
      subjectBreakdown[subject] = {
        avgCompletion: data.count > 0 ? data.totalCompletion / data.count : 0,
        spaceCount: data.count,
      };
    }

    const sortedRecent = topN(recentActivity, 10, (e) =>
      e.date?.toMillis ? e.date.toMillis() : 0
    );

    const levelup: StudentLevelupMetrics = {
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
      const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(
        autogradeBreakdown,
        subjectBreakdown
      );

      const autogradeAvgScore = existingSummary?.autograde?.averageScore ?? 0;
      const overallScore = computeOverallScore(autogradeAvgScore, averageCompletion);

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
          lastUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    console.log(
      `Updated levelup summary for student ${userId}: ${totalSpaces} spaces, ${averageCompletion.toFixed(1)}% avg completion`
    );
  }
);
