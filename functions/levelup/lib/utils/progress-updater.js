"use strict";
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
exports.recalculateAndWriteProgress = recalculateAndWriteProgress;
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
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
/** Maximum number of attempts to keep per item in the progress document. */
const MAX_ATTEMPTS = 20;
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
async function recalculateAndWriteProgress(params) {
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
    const existingItems = existingSubdocData.items ?? {};
    const existingStoryPoints = existingSpaceData.storyPoints ?? {};
    // ── Merge new items with existing (best-score retention) ──
    const mergedItems = { ...existingItems };
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
        const merged = {
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
        const prevAttempts = existing.attempts ?? [];
        if (entry.lastAnswer != null && entry.lastEvaluation) {
          const newAttempt = {
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
    let storyPointStatus = "in_progress";
    let storyPointCompletedAt = existingStoryPoints[storyPointId]?.completedAt;
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
        v2_1.logger.warn("Failed to check storyPoint completion", err);
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
    const mergedStoryPoints = { ...existingStoryPoints };
    mergedStoryPoints[storyPointId] = spSummary;
    // ── Space-level aggregation (from storyPoint summaries) ──
    let totalPointsEarned = 0;
    let totalPointsAvailable = 0;
    for (const sp of Object.values(mergedStoryPoints)) {
      totalPointsEarned += sp.pointsEarned ?? 0;
      totalPointsAvailable += sp.totalPoints ?? 0;
    }
    const overallPercentage =
      totalPointsAvailable > 0 ? (totalPointsEarned / totalPointsAvailable) * 100 : 0;
    // ── Space completion detection ──
    let spaceStatus = "in_progress";
    let spaceCompletedAt;
    if (storyPointStatus === "completed") {
      try {
        const spaceDoc2 = await transaction.get(db.doc(`tenants/${tenantId}/spaces/${spaceId}`));
        if (spaceDoc2.exists) {
          const spaceData = spaceDoc2.data();
          const totalStoryPoints = spaceData?.stats?.totalStoryPoints ?? 0;
          if (totalStoryPoints > 0) {
            let completedSPCount = 0;
            for (const spProgress of Object.values(mergedStoryPoints)) {
              if (spProgress.status === "completed") completedSPCount++;
            }
            if (completedSPCount >= totalStoryPoints) {
              spaceStatus = "completed";
              spaceCompletedAt = firestore_1.FieldValue.serverTimestamp();
            }
          }
        }
      } catch (err) {
        v2_1.logger.warn("Failed to check space completion", err);
      }
    }
    // ── Write space-level doc (no items — just summaries) ──
    const spaceProgressUpdate = {
      id: progressId,
      userId,
      tenantId,
      spaceId,
      status: spaceStatus,
      pointsEarned: totalPointsEarned,
      totalPoints: totalPointsAvailable,
      percentage: overallPercentage,
      storyPoints: mergedStoryPoints,
      startedAt: existingSpaceData.startedAt ?? firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
    v2_1.logger.warn("Failed to update RTDB leaderboard", err);
  }
  return result;
}
/** Recursively remove undefined values from an object so Firestore doesn't reject it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj) {
  if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj))
    return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = stripUndefined(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
//# sourceMappingURL=progress-updater.js.map
