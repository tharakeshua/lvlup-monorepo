/**
 * onStudentSummaryUpdated — Firestore trigger that recalculates a class's
 * progress summary when a student's summary changes.
 *
 * Debounce: skips recalculation if the class summary was updated within
 * the last 5 minutes to prevent write contention from multiple concurrent
 * student summary updates.
 *
 * Triggers on: /tenants/{tenantId}/studentProgressSummaries/{studentId}
 */
export declare const onStudentSummaryUpdated: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").DocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      studentId: string;
    }
  >
>;
