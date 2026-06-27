/**
 * Unified progress updater — single source of truth for SpaceProgress writes.
 *
 * Two-tier storage model:
 *   Space-level:      /tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
 *   StoryPoint-level: .../storyPointProgress/{storyPointId}
 *
 * Both record-item-attempt and submit-test-session delegate here so that
 * percentage scaling (0-100), best-score retention, per-storyPoint/space
 * aggregation, completion detection, and RTDB leaderboard updates all
 * happen in one transactional write.
 */
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type {
  ProgressStatus,
  ItemProgressEntry,
  StoredEvaluation,
  AttemptRecord,
} from "@levelup/shared-types";

/** Maximum number of attempts to keep per item in the progress document. */
const MAX_ATTEMPTS = 20;

/** Item entry passed into the updater — extends ItemProgressEntry with storyPointId. */
export interface StoredItemProgressEntry extends ItemProgressEntry {
  storyPointId: string;
}

export interface RecalculateProgressParams {
  db: FirebaseFirestore.Firestore;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  /** New/updated item entries keyed by itemId. Will be merged (best-score) with existing entries. */
  newItemEntries: Record<string, StoredItemProgressEntry>;
  /** If true, mark the storyPoint as completed regardless of item count (e.g. test submitted). */
  forceStoryPointComplete?: boolean;
}

/**
 * Recalculate and persist progress inside a Firestore transaction.
 *
 * 1. Reads existing storyPoint progress subdoc
 * 2. Merges new items (best-score retention)
 * 3. Re-aggregates storyPoint-level scores from ALL items in subdoc
 * 4. Writes storyPoint subdoc
 * 5. Re-aggregates space-level scores from ALL storyPoint summaries
 * 6. Detects storyPoint and space completion
 * 7. Writes space-level doc
 * 8. Updates RTDB leaderboard
 */
export async function recalculateAndWriteProgress(
  params: RecalculateProgressParams
): Promise<{ totalPointsEarned: number; overallPercentage: number }> {
  const { db, tenantId, userId, spaceId, storyPointId, newItemEntries, forceStoryPointComplete } =
    params;

  const progressId = `${userId}_${spaceId}`;
  const spaceProgressRef = db.doc(`tenants/${tenantId}/spaceProgress/${progressId}`);
  const spSubdocRef = spaceProgressRef.collection("storyPointProgress").doc(storyPointId);
  const now = Date.now();

  const result = await db.runTransaction(async (transaction) => {
    // ── Read existing docs ──
    const [spaceDoc, spSubdoc] = await Promise.all([
      transaction.get(spaceProgressRef),
      transaction.get(spSubdocRef),
    ]);

    const existingSpaceData = spaceDoc.exists ? (spaceDoc.data() ?? {}) : {};
    const existingSubdocData = spSubdoc.exists ? (spSubdoc.data() ?? {}) : {};
    const existingItems: Record<string, StoredItemProgressEntry> = existingSubdocData.items ?? {};
    const existingStoryPoints: Record<
      string,
      {
        storyPointId: string;
        status: ProgressStatus;
        pointsEarned: number;
        totalPoints: number;
        percentage: number;
        completedItems: number;
        totalItems: number;
        completedAt?: number;
      }
    > = existingSpaceData.storyPoints ?? {};

    // ── Merge new items with existing (best-score retention) ──
    const mergedItems: Record<string, StoredItemProgressEntry> = { ...existingItems };

    for (const [itemId, entry] of Object.entries(newItemEntries)) {
      const existing = mergedItems[itemId];
      if (existing?.questionData && entry.questionData) {
        // Best-score retention: keep the higher score
        const bestScore = Math.max(
          entry.questionData.bestScore ?? 0,
          existing.questionData.bestScore ?? 0
        );
        const latestScore = entry.questionData.bestScore ?? 0;
        const maxScore = entry.questionData.totalPoints ?? existing.questionData.totalPoints ?? 0;
        const attemptsCount = (existing.questionData.attemptsCount ?? 0) + 1;
        const solved = entry.questionData.solved || existing.questionData.solved;
        const completed = solved || (maxScore > 0 && bestScore / maxScore >= 0.5);
        const latestStatus = entry.questionData.status ?? "incorrect";

        // Build merged entry — Firestore rejects undefined, so only set optional fields when defined
        const merged: StoredItemProgressEntry = {
          ...entry,
          completed,
          timeSpent: (existing.timeSpent ?? 0) + (entry.timeSpent ?? 0),
          interactions: attemptsCount,
          questionData: {
            status: solved ? "correct" : bestScore > 0 ? "partial" : "incorrect",
            attemptsCount,
            bestScore,
            pointsEarned: bestScore,
            totalPoints: maxScore,
            percentage: maxScore > 0 ? (bestScore / maxScore) * 100 : 0,
            solved,
            latestScore,
            latestStatus,
          },
        };
        if (completed) merged.completedAt = existing.completedAt ?? entry.completedAt ?? now;
        const latestAnswer = entry.lastAnswer ?? existing.lastAnswer;
        if (latestAnswer != null) merged.lastAnswer = latestAnswer;
        const latestEval = entry.lastEvaluation ?? existing.lastEvaluation;
        if (latestEval != null) merged.lastEvaluation = latestEval;
        if (entry.feedback ?? existing.feedback)
          merged.feedback = entry.feedback ?? existing.feedback;

        // Append to attempt history (capped at 20 most recent)
        const prevAttempts: AttemptRecord[] = (existing.attempts ?? []) as AttemptRecord[];
        if (entry.lastAnswer != null && entry.lastEvaluation) {
          const newAttempt: AttemptRecord = {
            attemptNumber: attemptsCount,
            answer: entry.lastAnswer,
            evaluation: entry.lastEvaluation,
            score: latestScore,
            maxScore,
            timestamp: now,
          };
          merged.attempts = [...prevAttempts, newAttempt].slice(-MAX_ATTEMPTS);
        } else if (prevAttempts.length > 0) {
          merged.attempts = prevAttempts;
        }

        mergedItems[itemId] = merged;
      } else {
        // New entry or non-question (material, etc.)
        // For first question attempt, seed the attempts array
        if (entry.questionData && entry.lastAnswer != null && entry.lastEvaluation) {
          entry.attempts = [
            {
              attemptNumber: 1,
              answer: entry.lastAnswer,
              evaluation: entry.lastEvaluation,
              score: entry.questionData.bestScore ?? 0,
              maxScore: entry.questionData.totalPoints ?? 0,
              timestamp: now,
            },
          ];
          // Set latest fields on first attempt
          entry.questionData.latestScore = entry.questionData.bestScore;
          entry.questionData.latestStatus = entry.questionData.status;
        }
        mergedItems[itemId] = entry;
      }
    }

    // ── StoryPoint-level aggregation (from items in this subdoc) ──
    let spPointsEarned = 0;
    let spPointsAvailable = 0;
    let completedItems = 0;

    for (const entry of Object.values(mergedItems)) {
      if (entry.questionData) {
        spPointsEarned += entry.questionData.bestScore ?? 0;
        spPointsAvailable += entry.questionData.totalPoints ?? 0;
      } else if (entry.itemType === "material" && entry.completed) {
        spPointsEarned += 1;
        spPointsAvailable += 1;
      } else if (entry.itemType === "material") {
        spPointsAvailable += 1;
      }
      if (entry.completed) completedItems++;
    }

    // ── Read actual storyPoint metadata for accurate totalItems + totalPoints ──
    let actualTotalItems = Object.keys(mergedItems).length; // fallback to subdoc count
    let actualTotalPoints = spPointsAvailable; // fallback to attempted-items sum
    let storyPointStatus: ProgressStatus = "in_progress";
    let storyPointCompletedAt: number | undefined = existingStoryPoints[storyPointId]?.completedAt;

    if (forceStoryPointComplete) {
      storyPointStatus = "completed";
      storyPointCompletedAt = storyPointCompletedAt ?? now;
    } else {
      try {
        const storyPointDoc = await transaction.get(
          db.doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}`)
        );
        if (storyPointDoc.exists) {
          const spData = storyPointDoc.data();
          const totalItemsInSP = spData?.stats?.totalItems ?? 0;
          const totalPointsInSP = spData?.stats?.totalPoints ?? 0;
          if (totalItemsInSP > 0) {
            actualTotalItems = totalItemsInSP;
          }
          if (totalPointsInSP > 0) {
            actualTotalPoints = totalPointsInSP;
          }
          if (totalItemsInSP > 0 && completedItems >= totalItemsInSP) {
            storyPointStatus = "completed";
            storyPointCompletedAt = storyPointCompletedAt ?? now;
          }
        }
      } catch (err) {
        logger.warn("Failed to check storyPoint completion", err);
      }
    }

    const spPercentage = actualTotalPoints > 0 ? (spPointsEarned / actualTotalPoints) * 100 : 0;

    // ── Strip undefined values from all items (Firestore rejects undefined) ──
    for (const [itemId, entry] of Object.entries(mergedItems)) {
      mergedItems[itemId] = stripUndefined(entry);
    }

    // ── Write storyPoint subdoc ──
    const spSummary = {
      storyPointId,
      status: storyPointStatus,
      pointsEarned: spPointsEarned,
      totalPoints: actualTotalPoints,
      percentage: spPercentage,
      completedItems,
      totalItems: actualTotalItems,
      ...(storyPointCompletedAt ? { completedAt: storyPointCompletedAt } : {}),
    };

    transaction.set(spSubdocRef, {
      ...spSummary,
      items: mergedItems,
      updatedAt: now,
    });

    // ── Build merged storyPoints map for space doc ──
    const mergedStoryPoints: Record<string, unknown> = { ...existingStoryPoints };
    mergedStoryPoints[storyPointId] = spSummary;

    // ── Space-level aggregation (from storyPoint summaries) ──
    let totalPointsEarned = 0;
    let totalPointsAvailable = 0;

    for (const sp of Object.values(mergedStoryPoints) as Array<{
      pointsEarned: number;
      totalPoints: number;
    }>) {
      totalPointsEarned += sp.pointsEarned ?? 0;
      totalPointsAvailable += sp.totalPoints ?? 0;
    }

    const overallPercentage =
      totalPointsAvailable > 0 ? (totalPointsEarned / totalPointsAvailable) * 100 : 0;

    // ── Space completion detection ──
    let spaceStatus: ProgressStatus = "in_progress";
    let spaceCompletedAt: FieldValue | undefined;

    if (storyPointStatus === "completed") {
      try {
        const spaceDoc2 = await transaction.get(db.doc(`tenants/${tenantId}/spaces/${spaceId}`));
        if (spaceDoc2.exists) {
          const spaceData = spaceDoc2.data();
          const totalStoryPoints = spaceData?.stats?.totalStoryPoints ?? 0;

          if (totalStoryPoints > 0) {
            let completedSPCount = 0;
            for (const spProgress of Object.values(mergedStoryPoints) as Array<{
              status?: string;
            }>) {
              if (spProgress.status === "completed") completedSPCount++;
            }
            if (completedSPCount >= totalStoryPoints) {
              spaceStatus = "completed";
              spaceCompletedAt = FieldValue.serverTimestamp();
            }
          }
        }
      } catch (err) {
        logger.warn("Failed to check space completion", err);
      }
    }

    // ── Write space-level doc (no items — just summaries) ──
    const spaceProgressUpdate: Record<string, unknown> = {
      id: progressId,
      userId,
      tenantId,
      spaceId,
      status: spaceStatus,
      pointsEarned: totalPointsEarned,
      totalPoints: totalPointsAvailable,
      percentage: overallPercentage,
      storyPoints: mergedStoryPoints,
      startedAt: existingSpaceData.startedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (spaceCompletedAt) {
      spaceProgressUpdate.completedAt = spaceCompletedAt;
    }

    transaction.set(spaceProgressRef, spaceProgressUpdate, { merge: true });

    return { totalPointsEarned, overallPercentage };
  });

  // ── Update RTDB leaderboard (outside transaction — RTDB doesn't participate) ──
  try {
    const rtdb = admin.database();
    const userDoc = await db.doc(`users/${userId}`).get();
    const userData = userDoc.data();

    await rtdb.ref(`leaderboards/${tenantId}/${spaceId}/${userId}`).set({
      points: result.totalPointsEarned,
      displayName: userData?.displayName ?? "Student",
      avatarUrl: userData?.photoUrl ?? null,
      completionPercent: Math.round(result.overallPercentage),
      updatedAt: now,
    });
  } catch (err) {
    logger.warn("Failed to update RTDB leaderboard", err);
  }

  return result;
}

/** Recursively remove undefined values from an object so Firestore doesn't reject it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj))
    return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = stripUndefined(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
