/**
 * Firestore trigger: cascade delete when a space is deleted.
 *
 * Cleans up:
 * - All storyPoints
 * - All items (and their answerKeys subcollections)
 * - All agents
 * - All digitalTestSessions for this space
 * - All spaceProgress for this space
 * - All chatSessions for this space
 * - RTDB leaderboard data
 */
export declare const onSpaceDeleted: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    import("firebase-functions/firestore").QueryDocumentSnapshot | undefined,
    {
      tenantId: string;
      spaceId: string;
    }
  >
>;
