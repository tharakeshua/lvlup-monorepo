/**
 * `progressRepo` (SDK-LAYERS-PLAN §4.1, §4.4, domain plan §Repositories).
 *
 * Reads the server-authoritative learning-progress aggregates and is the client
 * edge of the one optimistic authority-adjacent write (`recordAttempt`):
 *   • `recordAttempt(input)` sends the RAW learner `answer` and NEVER a
 *     client-set score/maxScore/correct (CD13 — the SERVER scores, §6.5); it
 *     returns the authoritative `{progress, completed}` unchanged so the query
 *     layer reconciles best-score from THIS response (A11), not the optimistic
 *     patch.
 *   • Derived fields computed once (UI never recomputes): completion %, overall
 *     score blend, sorted+status-decorated story-point summaries, next-incomplete
 *     story point, capped/sorted attempt history.
 *
 * Per-entity repo — `api` + `@levelup/domain` only; never a sibling repo (R6).
 */
import type {
  AttemptRecord,
  ItemProgressEntry,
  SpaceId,
  SpaceProgress,
  StoryPointId,
  StoryPointProgress,
  UserId,
} from "@levelup/domain";
import type {
  ApiClient,
  ItemProgressView,
  RecordItemAttemptRequest,
  RecordItemAttemptResponse,
  SpaceProgressView,
  StoryPointProgressDocView,
} from "./api-types.js";

/** Cap on the attempt history surfaced for display (domain plan §ItemProgressEntry). */
const ATTEMPT_HISTORY_CAP = 20;

/** A story-point summary decorated with derived status for the dashboard. */
export interface StoryPointSummaryView extends StoryPointProgress {
  isComplete: boolean;
}

export interface ProgressRepo {
  getSpace(spaceId: SpaceId, userId?: UserId): Promise<SpaceProgressView | null>;
  getStoryPoint(
    spaceId: SpaceId,
    storyPointId: StoryPointId,
    userId?: UserId
  ): Promise<StoryPointProgressDocView | null>;
  /** CD13/A11 — sends raw `answer`, returns the authoritative response unchanged. */
  recordAttempt(input: RecordItemAttemptRequest): Promise<RecordItemAttemptResponse>;

  // derived (computed once)
  /**
   * Item-completion percentage, bounded 0..100 (§4.1). Derived locally from the
   * already-fetched `{completedItems,totalItems}` aggregate — no wire call.
   */
  computeCompletionPct(progress: { completedItems: number; totalItems: number }): number;
  computeOverallScore(progress: SpaceProgress): number;
  computeStoryPointSummaries(progress: SpaceProgress): StoryPointSummaryView[];
  isStoryPointComplete(sp: Pick<StoryPointProgress, "status">): boolean;
  resolveNextIncompleteStoryPoint(
    progress: SpaceProgress,
    storyPointIds: readonly StoryPointId[]
  ): StoryPointId | null;
  computeAttemptHistory(itemProgress: Pick<ItemProgressView, "attempts">): AttemptRecord[];
}

export function createProgressRepo(api: ApiClient): ProgressRepo {
  const repo: ProgressRepo = {
    getSpace: async (spaceId, userId) => {
      const req = userId === undefined ? { spaceId } : { spaceId, userId };
      return (await api.levelup.getSpaceProgress(req)).progress;
    },
    getStoryPoint: async (spaceId, storyPointId, userId) => {
      const req =
        userId === undefined ? { spaceId, storyPointId } : { spaceId, storyPointId, userId };
      return (await api.levelup.getStoryPointProgress(req)).progress;
    },
    // CD13: pass the request body THROUGH — never inject a score onto the wire.
    recordAttempt: (input) => api.levelup.recordItemAttempt(input),

    computeCompletionPct: ({ completedItems, totalItems }) => {
      if (!totalItems || totalItems <= 0) return 0;
      const pct = Math.round((completedItems / totalItems) * 100);
      return Math.max(0, Math.min(100, pct));
    },
    computeOverallScore: (progress) =>
      progress.totalPoints > 0
        ? Math.round((progress.pointsEarned / progress.totalPoints) * 100) / 100
        : 0,
    computeStoryPointSummaries: (progress) =>
      Object.values(progress.storyPoints)
        .map((sp) => ({ ...sp, isComplete: sp.status === "completed" }))
        .sort((a, b) => String(a.storyPointId).localeCompare(String(b.storyPointId))),
    isStoryPointComplete: (sp) => sp.status === "completed",
    resolveNextIncompleteStoryPoint: (progress, storyPointIds) => {
      for (const id of storyPointIds) {
        const sp = progress.storyPoints[id as string];
        if (!sp || sp.status !== "completed") return id;
      }
      return null;
    },
    computeAttemptHistory: (itemProgress) => {
      const attempts = itemProgress.attempts ?? [];
      return [...attempts]
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, ATTEMPT_HISTORY_CAP);
    },
  };
  return repo;
}
