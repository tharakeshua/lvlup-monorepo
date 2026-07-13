/**
 * onSpaceProgressUpdated — Firestore trigger that recalculates the LevelUp
 * section of a student's progress summary when space progress changes.
 *
 * Triggers on: /tenants/{tenantId}/spaceProgress/{progressId}
 * progressId format: {userId}_{spaceId}
 */
export declare const onSpaceProgressUpdated: import("firebase-functions/core").CloudFunction<
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
