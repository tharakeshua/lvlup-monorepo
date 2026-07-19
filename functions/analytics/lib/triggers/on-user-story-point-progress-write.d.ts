/**
 * onUserStoryPointProgressWrite — Firestore trigger that updates leaderboard
 * and student summary metrics when a student completes a story point.
 *
 * Triggers on: /tenants/{tenantId}/spaceProgress/{progressId}
 * (same collection as on-space-progress-updated, but focuses on the
 * per-story-point breakdown within SpaceProgress.storyPoints)
 *
 * When a story point transitions to 'completed', this trigger:
 * 1. Updates the story-point-level leaderboard in RTDB
 * 2. Recalculates LevelUp metrics on the student's progress summary
 */
export declare const onUserStoryPointProgressWrite: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").DocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      progressId: string;
    }
  >
>;
