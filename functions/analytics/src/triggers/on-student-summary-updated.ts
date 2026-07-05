/**
 * onStudentSummaryUpdated — Firestore trigger that recalculates a class's
 * progress summary when a student's summary changes.
 *
 * Debounce: skips recalculation if the class summary was updated within
 * the last 5 minutes to prevent write contention from multiple concurrent
 * student summary updates.
 *
 * Triggers on: /tenants/{tenantId}/studentProgressSummaries/{studentId}
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { isoNow } from "@levelup/domain";
import { topN, bottomN, legacyMillis } from "../utils/aggregation-helpers";
import type { ClassProgressSummary } from "../contracts/legacy-docs";

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

export const onStudentSummaryUpdated = onDocumentWritten(
  {
    document: "tenants/{tenantId}/studentProgressSummaries/{studentId}",
    region: "asia-south1",
    memory: "512MiB",
  },
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return;

    const { tenantId, studentId } = event.params;
    const db = admin.firestore();

    // Find which classes this student belongs to
    const membershipsSnap = await db
      .collection(`tenants/${tenantId}/memberships`)
      .where("uid", "==", studentId)
      .where("role", "==", "student")
      .where("status", "==", "active")
      .limit(10)
      .get();

    // Get class IDs from the student doc or memberships
    const classIds: string[] = [];
    for (const doc of membershipsSnap.docs) {
      const membership = doc.data();
      if (membership.schoolId) classIds.push(membership.schoolId);
    }

    if (classIds.length === 0) {
      console.log(`Student ${studentId} has no class memberships. Skipping class summary update.`);
      return;
    }

    for (const classId of classIds) {
      await updateClassSummary(db, tenantId, classId);
    }
  }
);

async function updateClassSummary(
  db: admin.firestore.Firestore,
  tenantId: string,
  classId: string
): Promise<void> {
  const classSummaryRef = db.doc(`tenants/${tenantId}/classProgressSummaries/${classId}`);

  // Debounce check
  const existingSummary = await classSummaryRef.get();
  if (existingSummary.exists) {
    // B8: lastUpdatedAt may be a Firestore Timestamp object OR an ISO string —
    // the old `typeof .toMillis === "function"` guard would silently disable
    // the debounce once ISO strings land at rest.
    const lastUpdatedMs = legacyMillis(existingSummary.data()?.lastUpdatedAt);
    if (lastUpdatedMs > 0) {
      const elapsed = Date.now() - lastUpdatedMs;
      if (elapsed < DEBOUNCE_MS) {
        // Mark that a recalculation is pending so a future run picks it up
        await classSummaryRef.update({ pendingRecalculation: true });
        console.log(
          `Class ${classId} summary updated ${elapsed}ms ago. Debouncing (marked pending).`
        );
        return;
      }
    }
  }

  // Fetch class info
  const classDoc = await db.doc(`tenants/${tenantId}/classes/${classId}`).get();
  const className = classDoc.data()?.name ?? classId;

  // Fetch all student memberships for this class
  const studentMemberships = await db
    .collection(`tenants/${tenantId}/memberships`)
    .where("schoolId", "==", classId)
    .where("role", "==", "student")
    .where("status", "==", "active")
    .get();

  const studentIds = studentMemberships.docs.map((d) => d.data().uid as string);
  if (studentIds.length === 0) return;

  // Fetch all student summaries in batches
  const allSummaries: admin.firestore.DocumentData[] = [];
  for (let i = 0; i < studentIds.length; i += 30) {
    const batch = studentIds.slice(i, i + 30);
    const summariesSnap = await db
      .collection(`tenants/${tenantId}/studentProgressSummaries`)
      .where(admin.firestore.FieldPath.documentId(), "in", batch)
      .get();
    for (const doc of summariesSnap.docs) {
      allSummaries.push({ id: doc.id, ...doc.data() });
    }
  }

  // Aggregate AutoGrade metrics
  let totalExamScore = 0;
  let totalExamCompletionRate = 0;
  let examStudentCount = 0;

  // Aggregate LevelUp metrics
  let totalCompletion = 0;
  let activeStudents = 0;

  const atRiskStudentIds: string[] = [];
  const studentPerformance: Array<{
    studentId: string;
    name: string;
    avgScore: number;
    points: number;
  }> = [];

  // Build student name lookup
  const nameMap = new Map<string, string>();
  for (const doc of studentMemberships.docs) {
    const m = doc.data();
    nameMap.set(m.uid, m.displayName ?? m.uid);
  }

  for (const summary of allSummaries) {
    const autograde = summary.autograde;
    const levelup = summary.levelup;

    if (autograde?.completedExams > 0) {
      totalExamScore += autograde.averageScore;
      totalExamCompletionRate += autograde.completedExams / Math.max(autograde.totalExams, 1);
      examStudentCount++;
    }

    if (levelup) {
      totalCompletion += levelup.averageCompletion ?? 0;
      if (levelup.totalSpaces > 0) activeStudents++;
    }

    if (summary.isAtRisk) {
      atRiskStudentIds.push(summary.id);
    }

    studentPerformance.push({
      studentId: summary.id,
      name: nameMap.get(summary.id) ?? summary.id,
      avgScore: autograde?.averageScore ?? 0,
      points: levelup?.totalPointsEarned ?? 0,
    });
  }

  const studentCount = studentIds.length;

  const classSummary: ClassProgressSummary = {
    id: classId,
    tenantId,
    classId,
    className,
    studentCount,
    autograde: {
      averageClassScore: examStudentCount > 0 ? totalExamScore / examStudentCount : 0,
      examCompletionRate: examStudentCount > 0 ? totalExamCompletionRate / examStudentCount : 0,
      topPerformers: topN(studentPerformance, 5, (s) => s.avgScore).map(
        ({ studentId, name, avgScore }) => ({ studentId, name, avgScore })
      ),
      bottomPerformers: bottomN(studentPerformance, 5, (s) => s.avgScore).map(
        ({ studentId, name, avgScore }) => ({ studentId, name, avgScore })
      ),
    },
    levelup: {
      averageClassCompletion: allSummaries.length > 0 ? totalCompletion / allSummaries.length : 0,
      activeStudentRate: studentCount > 0 ? activeStudents / studentCount : 0,
      topPointEarners: topN(studentPerformance, 5, (s) => s.points).map(
        ({ studentId, name, points }) => ({ studentId, name, points })
      ),
    },
    atRiskStudentIds,
    atRiskCount: atRiskStudentIds.length,
    lastUpdatedAt: isoNow(), // B8: ISO strings are canonical at rest
  };

  await classSummaryRef.set(classSummary);

  console.log(
    `Updated class summary for ${classId}: ${studentCount} students, ${atRiskStudentIds.length} at-risk`
  );
}
