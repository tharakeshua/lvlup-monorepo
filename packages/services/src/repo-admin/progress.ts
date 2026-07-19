/**
 * `progress` — THE single transactional progress writer (testsession-progress
 * §progressUpdater; MERGE-SINGLE-WRITER). Every per-item completion (submit /
 * evaluate / record) funnels here. The whole read-modify-write happens inside ONE
 * Firestore transaction on the aggregate `spaceProgress/{userId}_{spaceId}` doc,
 * so N concurrent AI-item completions serialize: Firestore aborts + retries on
 * contention rather than letting a lost-update clobber best-score retention.
 *
 * Responsibilities kept from the live progressUpdater:
 *   • best-score retention per item (never regress a higher prior score),
 *   • two-tier aggregation (item → storyPoint → space),
 *   • completion detection (all known story points complete),
 *   • the per-story-point rollup is RETURNED so `applyProgress` can feed the
 *     `spaceProgressLive` RTDB projection (AD-12 — the old in-tx Firestore
 *     `/projection/live` doc is retired: nothing reads it post-flip),
 *   • the inline RTDB leaderboard sync is REMOVED (a recompute marker is set; the
 *     single leaderboard writer consumes it — §5.3).
 */
import { type Firestore, type Transaction } from "firebase-admin/firestore";
import type { ItemSubmissionDoc } from "@levelup/domain";
import { docFromFirestore, toFirestore } from "./firestore.js";
import {
  itemSubmissionDoc,
  progressApplicationDoc,
  spaceProgressDoc,
  spaceProgressId,
} from "./paths.js";
import { makeRepoError } from "./errors.js";
import type { ProgressRepo, ProgressUpdateInput, ProgressUpdateResult } from "./types.js";

interface ItemEntry {
  itemId: string;
  storyPointId: string;
  score: number;
  maxScore: number;
  correct: boolean;
  timeSpentMs?: number;
  updatedAt: string;
  evaluation?: Record<string, unknown>;
}

interface ProgressDoc {
  id: string;
  userId: string;
  spaceId: string;
  tenantId: string;
  items: Record<string, ItemEntry>;
  storyPoints: Record<
    string,
    { storyPointId: string; pointsEarned: number; totalPoints: number; completed: boolean }
  >;
  pointsEarned: number;
  totalPoints: number;
  completed: boolean;
  totalStoryPoints?: number;
  recomputeMarker?: string;
  updatedAt: string;
  createdAt?: string;
}

function emptyDoc(
  id: string,
  tenantId: string,
  userId: string,
  spaceId: string,
  now: string
): ProgressDoc {
  return {
    id,
    userId,
    spaceId,
    tenantId,
    items: {},
    storyPoints: {},
    pointsEarned: 0,
    totalPoints: 0,
    completed: false,
    updatedAt: now,
    createdAt: now,
  };
}

function applyUpdates(
  doc: ProgressDoc,
  input: ProgressUpdateInput,
  now: string
): ProgressUpdateResult {
  doc.items ??= {};
  doc.storyPoints ??= {};

  // 1. Apply per-item updates with best-score retention.
  for (const u of input.items) {
    const prior = doc.items[u.itemId];
    const keepPrior = prior && prior.score >= u.score;
    if (!keepPrior) {
      doc.items[u.itemId] = {
        itemId: u.itemId,
        storyPointId: u.storyPointId,
        score: u.score,
        maxScore: u.maxScore,
        correct: u.correct,
        timeSpentMs: u.timeSpentMs,
        updatedAt: now,
        evaluation: u.evaluation,
      };
    }
  }

  // 2. Re-aggregate story points from the item map (idempotent).
  const spAgg = new Map<string, { earned: number; total: number }>();
  for (const entry of Object.values(doc.items)) {
    const current = spAgg.get(entry.storyPointId) ?? { earned: 0, total: 0 };
    current.earned += entry.score;
    current.total += entry.maxScore;
    spAgg.set(entry.storyPointId, current);
  }
  doc.storyPoints = {};
  for (const [storyPointId, agg] of spAgg.entries()) {
    doc.storyPoints[storyPointId] = {
      storyPointId,
      pointsEarned: agg.earned,
      totalPoints: agg.total,
      completed: agg.total > 0 && agg.earned >= agg.total,
    };
  }

  // 3. Space-level rollup + completion detection.
  doc.pointsEarned = Object.values(doc.storyPoints).reduce((sum, sp) => sum + sp.pointsEarned, 0);
  doc.totalPoints = Object.values(doc.storyPoints).reduce((sum, sp) => sum + sp.totalPoints, 0);
  if (input.totalStoryPoints != null) doc.totalStoryPoints = input.totalStoryPoints;
  const knownStoryPoints = Object.values(doc.storyPoints);
  const expected = doc.totalStoryPoints ?? knownStoryPoints.length;
  doc.completed =
    expected > 0 &&
    knownStoryPoints.length >= expected &&
    knownStoryPoints.every((storyPoint) => storyPoint.completed);
  doc.updatedAt = now;
  // Set a recompute marker rather than an inline leaderboard/summary write.
  doc.recomputeMarker = now;

  return {
    spaceProgressId: doc.id,
    completed: doc.completed,
    pointsEarned: doc.pointsEarned,
    totalPoints: doc.totalPoints,
    storyPoints: { ...doc.storyPoints },
  };
}

function asSubmission(value: Record<string, unknown>): ItemSubmissionDoc {
  return value as unknown as ItemSubmissionDoc;
}

export function makeProgressRepo(firestore: Firestore, nowFn: () => string): ProgressRepo {
  return {
    async update(tenantId, input: ProgressUpdateInput, now = nowFn()) {
      const aggRef = firestore.doc(spaceProgressDoc(tenantId, input.userId, input.spaceId));

      const result = await firestore.runTransaction(async (tx: Transaction) => {
        const snap = await tx.get(aggRef);
        const doc: ProgressDoc = snap.exists
          ? (docFromFirestore({ ...snap.data() }) as unknown as ProgressDoc)
          : emptyDoc(
              spaceProgressId(input.userId, input.spaceId),
              tenantId,
              input.userId,
              input.spaceId,
              now
            );
        const result = applyUpdates(doc, input, now);

        tx.set(aggRef, toFirestore(doc as unknown as Record<string, unknown>), { merge: true });
        return result;
      });

      return result;
    },

    async get(tenantId, userId, spaceId) {
      const snap = await firestore.doc(spaceProgressDoc(tenantId, userId, spaceId)).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },

    async applySubmission(tenantId, submissionId, now = nowFn()) {
      const submissionRef = firestore.doc(itemSubmissionDoc(tenantId, submissionId));
      return firestore.runTransaction(async (tx: Transaction) => {
        const submissionSnap = await tx.get(submissionRef);
        if (!submissionSnap.exists) {
          throw makeRepoError("NOT_FOUND", "Item submission was not found");
        }
        const submission = asSubmission(
          docFromFirestore({ ...submissionSnap.data(), id: submissionSnap.id })
        );
        if (!submission.evaluation) {
          throw makeRepoError(
            "PRECONDITION_FAILED",
            "Progress cannot be applied before evaluation"
          );
        }
        if (
          submission.workflow.status !== "evaluated" &&
          submission.workflow.status !== "progress_applied"
        ) {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "Submission is not ready for progress application"
          );
        }
        const markerRef = firestore.doc(
          progressApplicationDoc(tenantId, submission.ownerUid, submission.spaceId, submissionId)
        );
        const aggregateRef = firestore.doc(
          spaceProgressDoc(tenantId, submission.ownerUid, submission.spaceId)
        );
        const markerSnap = await tx.get(markerRef);
        const aggregateSnap = await tx.get(aggregateRef);
        const aggregate: ProgressDoc | undefined = aggregateSnap.exists
          ? (docFromFirestore({ ...aggregateSnap.data() }) as unknown as ProgressDoc)
          : undefined;

        if (markerSnap.exists) {
          const marker = docFromFirestore({ ...markerSnap.data(), id: markerSnap.id });
          if (
            marker["submissionId"] !== submissionId ||
            marker["evaluationResultHash"] !== submission.evaluation.resultHash ||
            !aggregate
          ) {
            throw makeRepoError(
              "CONFLICT",
              "Existing progress marker does not match the evaluated submission"
            );
          }
          return {
            applied: false,
            progress: {
              spaceProgressId: aggregate.id,
              completed: aggregate.completed,
              pointsEarned: aggregate.pointsEarned,
              totalPoints: aggregate.totalPoints,
              storyPoints: { ...aggregate.storyPoints },
            },
          };
        }

        const progress =
          aggregate ??
          emptyDoc(
            spaceProgressId(submission.ownerUid, submission.spaceId),
            tenantId,
            submission.ownerUid,
            submission.spaceId,
            now
          );
        const result = applyUpdates(
          progress,
          {
            userId: submission.ownerUid,
            spaceId: submission.spaceId,
            items: [
              {
                storyPointId: submission.storyPointId,
                itemId: submission.itemId,
                score: submission.evaluation.result.score,
                maxScore: submission.evaluation.result.maxScore,
                correct: submission.evaluation.result.correctness >= 1,
                evaluation: submission.evaluation.safeResult as unknown as Record<string, unknown>,
              },
            ],
          },
          now
        );
        const marker = {
          schemaVersion: 1,
          id: submissionId,
          tenantId,
          ownerUid: submission.ownerUid,
          spaceId: submission.spaceId,
          storyPointId: submission.storyPointId,
          itemId: submission.itemId,
          submissionId,
          evaluationResultHash: submission.evaluation.resultHash,
          score: submission.evaluation.result.score,
          maxScore: submission.evaluation.result.maxScore,
          appliedAt: now,
        };
        const nextSubmission = asSubmission({
          ...submission,
          workflow: {
            ...submission.workflow,
            status: "progress_applied",
            progressAppliedAt: now,
          },
          updatedAt: now,
        });
        tx.set(aggregateRef, toFirestore(progress as unknown as Record<string, unknown>));
        tx.set(markerRef, toFirestore(marker));
        tx.set(submissionRef, toFirestore(nextSubmission as unknown as Record<string, unknown>));
        return { applied: true, progress: result };
      });
    },
  };
}
