import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { loadItems } from "../utils/firestore";
import { autoEvaluateSubmission } from "../utils/auto-evaluate";
import type { QuestionPayload, TestSubmission, AnswerKey } from "../types";

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
export const onTestSessionExpired = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = Timestamp.now();

    // Grace period already elapsed: deadline + 30s < now
    // We look for sessions whose deadline is at least 30s in the past
    const graceThreshold = Timestamp.fromMillis(now.toMillis() - 30_000);

    // Query across all tenants using collectionGroup
    const staleSessions = await db
      .collectionGroup("digitalTestSessions")
      .where("status", "==", "in_progress")
      .where("serverDeadline", "<", graceThreshold)
      .limit(500) // Process in batches
      .get();

    if (staleSessions.empty) {
      logger.info("No stale test sessions found");
      return;
    }

    logger.info(`Found ${staleSessions.size} stale test sessions to expire`);

    // Batch update (max 500 per batch)
    const batch = db.batch();
    let count = 0;

    for (const sessionDoc of staleSessions.docs) {
      batch.update(sessionDoc.ref, {
        status: "expired",
        // U3.5: session timing fields stay Firestore Timestamps at rest.
        // serverDeadline (the query field above) is likewise always a Timestamp.
        endedAt: now,
        autoSubmitted: true,
        updatedAt: isoNow(),
      });
      count++;
    }

    await batch.commit();
    logger.info(`Expired ${count} stale test sessions`);

    // Grade expired sessions that have submissions
    for (const sessionDoc of staleSessions.docs) {
      const sessionData = sessionDoc.data();
      if (!sessionData.submissions || Object.keys(sessionData.submissions).length === 0) continue;
      try {
        const pathParts = sessionDoc.ref.path.split("/");
        const tenantId = pathParts[1];
        const items = await loadItems(tenantId, sessionData.spaceId, sessionData.storyPointId);
        const itemMap = new Map(items.map((i) => [i.id, i]));

        // Load answer keys — try nested path first, fallback to flat
        const answerKeyMap = new Map<string, AnswerKey>();
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
              if (!akSnap.empty) answerKeyMap.set(item.id, akSnap.docs[0].data() as AnswerKey);
            })
        );

        let pointsEarned = 0;
        let totalPoints = 0;
        const gradedSubmissions: Record<string, TestSubmission> = {};

        for (const [itemId, sub] of Object.entries(sessionData.submissions)) {
          const item = itemMap.get(itemId);
          if (!item) continue;
          const itemPoints =
            item.meta?.totalPoints ?? (item.payload as QuestionPayload)?.basePoints ?? 1;
          totalPoints += itemPoints;
          const answerKey = answerKeyMap.get(itemId);
          const submission = sub as TestSubmission;
          const autoResult = autoEvaluateSubmission(item, submission, answerKey);
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
        logger.info(`Graded expired session ${sessionDoc.id}: ${pointsEarned}/${totalPoints}`);
      } catch (err) {
        logger.warn(`Failed to grade expired session ${sessionDoc.id}:`, err);
      }
    }
  }
);
