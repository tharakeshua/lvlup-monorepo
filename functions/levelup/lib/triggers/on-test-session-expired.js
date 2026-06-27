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
exports.onTestSessionExpired = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const firestore_2 = require("../utils/firestore");
const auto_evaluate_1 = require("../utils/auto-evaluate");
/**
 * Scheduled function: cleanup stale timed test sessions.
 *
 * Runs every 5 minutes. Finds sessions that are:
 * - status === 'in_progress'
 * - serverDeadline has passed (+ 30s grace period has elapsed)
 *
 * These sessions are marked as 'expired' with autoSubmitted=true.
 * Per design doc §7.4: 24h threshold for truly stale sessions.
 */
exports.onTestSessionExpired = (0, scheduler_1.onSchedule)(
  {
    schedule: "every 5 minutes",
    region: "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = firestore_1.Timestamp.now();
    // Grace period already elapsed: deadline + 30s < now
    // We look for sessions whose deadline is at least 30s in the past
    const graceThreshold = firestore_1.Timestamp.fromMillis(now.toMillis() - 30_000);
    // Query across all tenants using collectionGroup
    const staleSessions = await db
      .collectionGroup("digitalTestSessions")
      .where("status", "==", "in_progress")
      .where("serverDeadline", "<", graceThreshold)
      .limit(500) // Process in batches
      .get();
    if (staleSessions.empty) {
      v2_1.logger.info("No stale test sessions found");
      return;
    }
    v2_1.logger.info(`Found ${staleSessions.size} stale test sessions to expire`);
    // Batch update (max 500 per batch)
    const batch = db.batch();
    let count = 0;
    for (const sessionDoc of staleSessions.docs) {
      batch.update(sessionDoc.ref, {
        status: "expired",
        endedAt: now,
        autoSubmitted: true,
        updatedAt: now,
      });
      count++;
    }
    await batch.commit();
    v2_1.logger.info(`Expired ${count} stale test sessions`);
    // Grade expired sessions that have submissions
    for (const sessionDoc of staleSessions.docs) {
      const sessionData = sessionDoc.data();
      if (!sessionData.submissions || Object.keys(sessionData.submissions).length === 0) continue;
      try {
        const pathParts = sessionDoc.ref.path.split("/");
        const tenantId = pathParts[1];
        const items = await (0, firestore_2.loadItems)(
          tenantId,
          sessionData.spaceId,
          sessionData.storyPointId
        );
        const itemMap = new Map(items.map((i) => [i.id, i]));
        // Load answer keys — try nested path first, fallback to flat
        const answerKeyMap = new Map();
        await Promise.all(
          items
            .filter((i) => i.type === "question")
            .map(async (item) => {
              let akSnap = await db
                .collection(
                  `tenants/${tenantId}/spaces/${sessionData.spaceId}/storyPoints/${sessionData.storyPointId}/items/${item.id}/answerKeys`
                )
                .limit(1)
                .get();
              if (akSnap.empty) {
                akSnap = await db
                  .collection(
                    `tenants/${tenantId}/spaces/${sessionData.spaceId}/items/${item.id}/answerKeys`
                  )
                  .limit(1)
                  .get();
              }
              if (!akSnap.empty) answerKeyMap.set(item.id, akSnap.docs[0].data());
            })
        );
        let pointsEarned = 0;
        let totalPoints = 0;
        const gradedSubmissions = {};
        for (const [itemId, sub] of Object.entries(sessionData.submissions)) {
          const item = itemMap.get(itemId);
          if (!item) continue;
          const itemPoints = item.meta?.totalPoints ?? item.payload?.basePoints ?? 1;
          totalPoints += itemPoints;
          const answerKey = answerKeyMap.get(itemId);
          const submission = sub;
          const autoResult = (0, auto_evaluate_1.autoEvaluateSubmission)(
            item,
            submission,
            answerKey
          );
          if (autoResult) {
            gradedSubmissions[itemId] = {
              ...submission,
              evaluation: autoResult,
              correct: autoResult.correctness >= 1,
              pointsEarned: autoResult.score,
              totalPoints: itemPoints,
            };
            pointsEarned += autoResult.score;
          } else {
            gradedSubmissions[itemId] = { ...submission, pointsEarned: 0, totalPoints: itemPoints };
          }
        }
        const percentage = totalPoints > 0 ? (pointsEarned / totalPoints) * 100 : 0;
        await sessionDoc.ref.update({
          submissions: gradedSubmissions,
          pointsEarned,
          totalPoints,
          percentage: Math.round(percentage * 100) / 100,
        });
        v2_1.logger.info(`Graded expired session ${sessionDoc.id}: ${pointsEarned}/${totalPoints}`);
      } catch (err) {
        v2_1.logger.warn(`Failed to grade expired session ${sessionDoc.id}:`, err);
      }
    }
  }
);
//# sourceMappingURL=on-test-session-expired.js.map
