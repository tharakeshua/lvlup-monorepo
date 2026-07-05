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
import { docFromFirestore, toFirestore } from "./firestore.js";
import { spaceProgressDoc, spaceProgressId } from "./paths.js";
import type { ProgressRepo, ProgressUpdateInput } from "./types.js";

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
        doc.items ??= {};
        doc.storyPoints ??= {};

        // 1. apply per-item updates with best-score retention
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

        // 2. re-aggregate story points from the item map (idempotent)
        const spAgg = new Map<string, { earned: number; total: number }>();
        for (const e of Object.values(doc.items)) {
          const cur = spAgg.get(e.storyPointId) ?? { earned: 0, total: 0 };
          cur.earned += e.score;
          cur.total += e.maxScore;
          spAgg.set(e.storyPointId, cur);
        }
        doc.storyPoints = {};
        for (const [spId, agg] of spAgg.entries()) {
          doc.storyPoints[spId] = {
            storyPointId: spId,
            pointsEarned: agg.earned,
            totalPoints: agg.total,
            completed: agg.total > 0 && agg.earned >= agg.total,
          };
        }

        // 3. space-level rollup + completion detection
        doc.pointsEarned = Object.values(doc.storyPoints).reduce((s, sp) => s + sp.pointsEarned, 0);
        doc.totalPoints = Object.values(doc.storyPoints).reduce((s, sp) => s + sp.totalPoints, 0);
        if (input.totalStoryPoints != null) doc.totalStoryPoints = input.totalStoryPoints;
        const knownStoryPoints = Object.values(doc.storyPoints);
        const expected = doc.totalStoryPoints ?? knownStoryPoints.length;
        doc.completed =
          expected > 0 &&
          knownStoryPoints.length >= expected &&
          knownStoryPoints.every((sp) => sp.completed);
        doc.updatedAt = now;
        // set the recompute marker instead of an inline leaderboard/summary write
        doc.recomputeMarker = now;

        tx.set(aggRef, toFirestore(doc as unknown as Record<string, unknown>), { merge: true });

        // 4. return the rollup — `applyProgress` projects it to the
        //    `spaceProgressLive` RTDB node (AD-12 side-channel; authority stays here)
        return {
          spaceProgressId: doc.id,
          completed: doc.completed,
          pointsEarned: doc.pointsEarned,
          totalPoints: doc.totalPoints,
          storyPoints: { ...doc.storyPoints },
        };
      });

      return result;
    },

    async get(tenantId, userId, spaceId) {
      const snap = await firestore.doc(spaceProgressDoc(tenantId, userId, spaceId)).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },
  };
}
