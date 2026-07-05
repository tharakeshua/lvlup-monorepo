import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTenantMember } from "../utils/auth";
import { RecordItemAttemptRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { recalculateAndWriteProgress } from "../utils/progress-updater";
import type { StoredItemProgressEntry } from "../utils/progress-updater";
import type { StoredEvaluation } from "../types";

interface RecordItemAttemptRequest {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  itemType: string;
  score: number;
  maxScore: number;
  correct: boolean;
  timeSpent?: number;
  feedback?: string;
  answer?: unknown;
  evaluationData?: StoredEvaluation;
}

/**
 * Record an item attempt for non-test items (standard storyPoints, practice, etc.).
 * Updates SpaceProgress with best score tracking via the unified progress updater.
 *
 * Fixes applied:
 * - No pre-increment of attemptsCount/timeSpent — progress-updater handles merging
 * - Passes answer and evaluationData for persistence on revisit
 */
export const recordItemAttempt = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const data = parseRequest(
    request.data,
    RecordItemAttemptRequestSchema
  ) as RecordItemAttemptRequest;

  if (!data.tenantId || !data.spaceId || !data.storyPointId || !data.itemId) {
    throw new HttpsError(
      "invalid-argument",
      "tenantId, spaceId, storyPointId, and itemId are required"
    );
  }

  await assertTenantMember(callerUid, data.tenantId);
  await enforceRateLimit(data.tenantId, callerUid, "write", 30);

  const now = Date.now();
  const itemType = data.itemType || "question";

  // Build a fresh item entry — the progress-updater handles merging
  // with existing data (best-score retention, attemptsCount increment).
  // We do NOT read existing progress here to avoid double-counting.
  // NOTE: Firestore rejects undefined values, so only include optional fields when set.
  const itemEntry: StoredItemProgressEntry = {
    itemId: data.itemId,
    storyPointId: data.storyPointId,
    itemType: itemType as StoredItemProgressEntry["itemType"],
    completed: data.correct || (data.maxScore > 0 && data.score / data.maxScore >= 0.5),
    timeSpent: data.timeSpent ?? 0,
    interactions: 1,
    lastUpdatedAt: now,
    questionData: {
      status: data.correct ? "correct" : data.score > 0 ? "partial" : "incorrect",
      attemptsCount: 1,
      bestScore: data.score,
      pointsEarned: data.score,
      totalPoints: data.maxScore,
      percentage: data.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0,
      solved: data.correct,
    },
  };

  // Only set optional fields when they have values (Firestore rejects undefined)
  if (data.correct) itemEntry.completedAt = now;
  if (data.answer != null) itemEntry.lastAnswer = data.answer;
  if (data.evaluationData) itemEntry.lastEvaluation = data.evaluationData;
  if (data.feedback) itemEntry.feedback = data.feedback;

  // Material-type items: set score and progress
  if (itemType === "material") {
    itemEntry.score = data.score;
    itemEntry.progress = data.correct ? 100 : (data.score / Math.max(data.maxScore, 1)) * 100;
    // Remove questionData for materials
    delete itemEntry.questionData;
  }

  const { totalPointsEarned, overallPercentage } = await recalculateAndWriteProgress({
    db: admin.firestore(),
    tenantId: data.tenantId,
    userId: callerUid,
    spaceId: data.spaceId,
    storyPointId: data.storyPointId,
    newItemEntries: { [data.itemId]: itemEntry },
  });

  logger.info(
    `Recorded attempt for item ${data.itemId} by user ${callerUid}: ${data.score}/${data.maxScore}`
  );

  return {
    success: true,
    bestScore: data.score,
    attemptsCount: 1,
    totalPointsEarned,
    overallPercentage,
  };
});
